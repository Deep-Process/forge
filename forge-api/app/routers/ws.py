"""WebSocket router — real-time event streaming per project."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.auth import _is_auth_configured, decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter()

_PING_INTERVAL = 30  # seconds


@router.websocket("/ws/projects/{slug}/events")
async def project_events(websocket: WebSocket, slug: str):
    """Stream real-time events for a project via WebSocket.

    Client connects, receives JSON messages for all entity mutations
    in the given project. Events are broadcast via Redis Pub/Sub.
    Authentication via ?token= query parameter or X-API-Key header.
    """
    # F-07: WebSocket authentication
    if _is_auth_configured():
        from app.config import settings
        import hmac

        token = websocket.query_params.get("token")
        api_key = websocket.headers.get("x-api-key")

        authenticated = False
        if api_key and settings.api_key and hmac.compare_digest(api_key, settings.api_key):
            authenticated = True
        elif token:
            try:
                decode_access_token(token)
                authenticated = True
            except JWTError:
                pass

        if not authenticated:
            await websocket.close(code=4001, reason="Unauthorized")
            return

    # Validate project exists before accepting (async to avoid blocking event loop)
    storage = websocket.app.state.storage
    if storage is not None:
        exists = await asyncio.to_thread(storage.exists, slug, "tracker")
        if not exists:
            await websocket.close(code=4004, reason="Project not found")
            return

    await websocket.accept()

    # Use shared EventBus from app state (F-06)
    event_bus = websocket.app.state.event_bus
    pubsub = None
    try:
        pubsub = await event_bus.subscribe(slug)
        last_ping = time.monotonic()

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await websocket.send_text(data)
            else:
                await asyncio.sleep(0.05)

            # Periodic ping to detect dead connections
            if time.monotonic() - last_ping >= _PING_INTERVAL:
                await websocket.send_json({"event": "ping"})
                last_ping = time.monotonic()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if pubsub is not None:
            await pubsub.unsubscribe()
            if hasattr(pubsub, "aclose"):
                await pubsub.aclose()
            elif hasattr(pubsub, "close"):
                await pubsub.close()

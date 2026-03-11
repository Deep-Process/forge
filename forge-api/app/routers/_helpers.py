"""Shared helpers for API routers — storage access wrappers."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import HTTPException, Request


# ---------------------------------------------------------------------------
# Entity-level locking (F-02: prevent race conditions in read-modify-write)
# ---------------------------------------------------------------------------

_entity_locks: dict[tuple[str, str], asyncio.Lock] = {}


def _get_lock(project: str, entity: str) -> asyncio.Lock:
    """Get or create an asyncio.Lock for a (project, entity) pair."""
    return _entity_locks.setdefault((project, entity), asyncio.Lock())


# ---------------------------------------------------------------------------
# Event emission helper
# ---------------------------------------------------------------------------

async def emit_event(request: Request, slug: str, event_type: str, payload: dict) -> None:
    """Emit an event if EventBus is available. Fire-and-forget."""
    event_bus = getattr(request.app.state, "event_bus", None)
    if event_bus is not None:
        try:
            await event_bus.emit(slug, event_type, payload)
        except Exception:
            pass  # Non-critical — don't fail the request


# ---------------------------------------------------------------------------
# Storage wrappers (sync → async bridge)
# ---------------------------------------------------------------------------

async def load_entity(storage, project: str, entity: str) -> dict:
    """Load entity data from storage adapter (sync → async bridge)."""
    return await asyncio.to_thread(storage.load_data, project, entity)


async def save_entity(storage, project: str, entity: str, data: dict) -> None:
    """Save entity data via storage adapter (sync → async bridge)."""
    await asyncio.to_thread(storage.save_data, project, entity, data)


async def load_global_entity(storage, entity: str) -> dict:
    """Load global entity data (e.g., skills) — uses _global/ storage."""
    return await asyncio.to_thread(storage.load_global, entity)


async def save_global_entity(storage, entity: str, data: dict) -> None:
    """Save global entity data — uses _global/ storage."""
    await asyncio.to_thread(storage.save_global, entity, data)


async def check_project_exists(storage, project: str) -> None:
    """Raise 404 if project doesn't exist in storage."""
    exists = await asyncio.to_thread(storage.exists, project, "tracker")
    if not exists:
        raise HTTPException(status_code=404, detail=f"Project '{project}' not found")


# ---------------------------------------------------------------------------
# Item lookup
# ---------------------------------------------------------------------------

def find_item(items: list[dict], item_id: str) -> dict | None:
    """Find an item by its 'id' field in a list."""
    for item in items:
        if item.get("id") == item_id:
            return item
    return None


def find_item_or_404(items: list[dict], item_id: str, entity_name: str = "Item") -> dict:
    """Find an item by id or raise 404."""
    item = find_item(items, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{entity_name} '{item_id}' not found")
    return item


def next_id(items: list[dict], prefix: str) -> str:
    """Generate next sequential ID (e.g., T-037, D-015)."""
    existing = []
    for item in items:
        item_id = item.get("id", "")
        if item_id.startswith(prefix + "-"):
            try:
                existing.append(int(item_id.split("-", 1)[1]))
            except ValueError:
                pass
    num = max(existing, default=0) + 1
    return f"{prefix}-{num:03d}"

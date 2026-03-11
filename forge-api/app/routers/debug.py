"""Debug router — LLM Debug Monitor: enable capture, list/view/clear sessions."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    emit_event,
    load_entity,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/debug", tags=["debug"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DebugToggleResponse(BaseModel):
    enabled: bool
    project: str


class DebugStatusResponse(BaseModel):
    enabled: bool
    project: str
    session_count: int


class DebugSessionSummary(BaseModel):
    session_id: str
    timestamp: str
    contract_id: str | None = None
    provider: str
    model: str
    task_id: str | None = None
    status: str
    latency_ms: int
    token_usage: dict[str, int] = {}
    error: str | None = None


class DebugSessionListResponse(BaseModel):
    sessions: list[dict[str, Any]]
    total: int


class DebugClearResponse(BaseModel):
    cleared: int


# ---------------------------------------------------------------------------
# Helper: access DebugCapture from app state
# ---------------------------------------------------------------------------

def _get_debug_capture(request: Request):
    """Return the DebugCapture instance from app state."""
    capture = getattr(request.app.state, "debug_capture", None)
    if capture is None:
        raise HTTPException(503, "Debug capture service not initialized")
    return capture


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/enable")
async def enable_debug(
    request: Request,
    slug: str,
    storage=Depends(get_storage),
) -> DebugToggleResponse:
    """Enable debug capture for a project.

    Sets a persistent flag so that subsequent LLM calls within this project
    will have their full request/response data captured.
    """
    await check_project_exists(storage, slug)
    capture = _get_debug_capture(request)
    await capture.enable(slug)

    await emit_event(request, slug, "debug.session", {
        "action": "enabled",
        "project": slug,
    })

    return DebugToggleResponse(enabled=True, project=slug)


@router.post("/disable")
async def disable_debug(
    request: Request,
    slug: str,
    storage=Depends(get_storage),
) -> DebugToggleResponse:
    """Disable debug capture for a project.

    Stops capturing debug data for new LLM calls. Existing sessions are
    preserved and remain queryable.
    """
    await check_project_exists(storage, slug)
    capture = _get_debug_capture(request)
    await capture.disable(slug)

    await emit_event(request, slug, "debug.session", {
        "action": "disabled",
        "project": slug,
    })

    return DebugToggleResponse(enabled=False, project=slug)


@router.get("/status")
async def debug_status(
    request: Request,
    slug: str,
    storage=Depends(get_storage),
) -> DebugStatusResponse:
    """Check whether debug capture is currently enabled for a project."""
    await check_project_exists(storage, slug)
    capture = _get_debug_capture(request)

    enabled = await capture.is_enabled(slug)
    session_count = await capture.get_session_count(slug)

    return DebugStatusResponse(
        enabled=enabled,
        project=slug,
        session_count=session_count,
    )


@router.get("/sessions")
async def list_debug_sessions(
    request: Request,
    slug: str,
    task_id: str | None = Query(None, description="Filter by task ID"),
    contract_id: str | None = Query(None, description="Filter by contract ID"),
    status: str | None = Query(None, description="Filter by status (success/error/validation_failed)"),
    limit: int = Query(50, ge=1, le=500, description="Max sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    storage=Depends(get_storage),
) -> DebugSessionListResponse:
    """List debug sessions with optional filters.

    Returns lightweight session summaries (not full captured payloads).
    Use the detail endpoint to retrieve the complete session data.
    """
    await check_project_exists(storage, slug)

    data = await load_entity(storage, slug, "debug_sessions")
    sessions: list[dict] = data.get("sessions", [])

    # Apply filters
    if task_id is not None:
        sessions = [s for s in sessions if s.get("task_id") == task_id]
    if contract_id is not None:
        sessions = [s for s in sessions if s.get("contract_id") == contract_id]
    if status is not None:
        sessions = [s for s in sessions if s.get("status") == status]

    # Sort by timestamp descending (newest first)
    sessions.sort(key=lambda s: s.get("timestamp", ""), reverse=True)

    total = len(sessions)

    # Paginate
    page = sessions[offset : offset + limit]

    # Build summaries (strip heavy fields)
    summaries = []
    for s in page:
        summaries.append({
            "session_id": s.get("session_id"),
            "timestamp": s.get("timestamp"),
            "contract_id": s.get("contract_id"),
            "provider": s.get("provider"),
            "model": s.get("model"),
            "task_id": s.get("task_id"),
            "execution_id": s.get("execution_id"),
            "status": s.get("status"),
            "latency_ms": s.get("latency_ms", 0),
            "token_usage": s.get("token_usage", {}),
            "error": s.get("error"),
        })

    return DebugSessionListResponse(sessions=summaries, total=total)


@router.get("/sessions/{session_id}")
async def get_debug_session(
    slug: str,
    session_id: str,
    storage=Depends(get_storage),
) -> dict[str, Any]:
    """Return the complete debug session with ALL captured data.

    Includes full prompts, raw response, validation results, and metrics.
    """
    await check_project_exists(storage, slug)

    data = await load_entity(storage, slug, "debug_sessions")
    sessions: list[dict] = data.get("sessions", [])

    for s in sessions:
        if s.get("session_id") == session_id:
            return s

    raise HTTPException(404, f"Debug session '{session_id}' not found")


@router.delete("/sessions")
async def clear_debug_sessions(
    request: Request,
    slug: str,
    storage=Depends(get_storage),
) -> DebugClearResponse:
    """Clear all debug sessions for a project.

    The debug enabled/disabled config is preserved; only session data is
    removed.
    """
    await check_project_exists(storage, slug)

    async with _get_lock(slug, "debug_sessions"):
        data = await load_entity(storage, slug, "debug_sessions")
        sessions = data.get("sessions", [])
        count = len(sessions)
        data["sessions"] = []
        await save_entity(storage, slug, "debug_sessions", data)

    await emit_event(request, slug, "debug.session", {
        "action": "cleared",
        "project": slug,
        "cleared": count,
    })

    return DebugClearResponse(cleared=count)

"""Changes router — CRUD + auto-detect from git."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    emit_event,
    find_item_or_404,
    load_entity,
    next_id,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/changes", tags=["changes"])


class ChangeRecord(BaseModel):
    task_id: str
    file: str
    action: Literal["create", "edit", "delete", "rename", "move"] = "edit"
    summary: str
    reasoning_trace: list[dict] = []
    decision_ids: list[str] = []
    lines_added: int = 0
    lines_removed: int = 0
    group_id: str = ""
    guidelines_checked: list[str] = []


@router.get("")
async def list_changes(
    slug: str,
    task_id: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "changes")
    changes = data.get("changes", [])
    if task_id:
        changes = [c for c in changes if c.get("task_id") == task_id]
    return {"changes": changes, "count": len(changes)}


@router.post("", status_code=201)
async def record_changes(request: Request, slug: str, body: list[ChangeRecord], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "changes"):
        data = await load_entity(storage, slug, "changes")
        changes = data.get("changes", [])
        added = []
        for item in body:
            change_id = next_id(changes, "C")
            change = {"id": change_id, **item.model_dump()}
            changes.append(change)
            added.append(change_id)
        data["changes"] = changes
        await save_entity(storage, slug, "changes", data)
    for i, c_id in enumerate(added):
        item = body[i] if i < len(body) else body[0]
        await emit_event(request, slug, "change.recorded", {
            "change_id": c_id, "task_id": item.task_id, "file": item.file, "action": item.action,
        })
    return {"added": added, "total": len(changes)}


@router.get("/{change_id}")
async def get_change(slug: str, change_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "changes")
    return find_item_or_404(data.get("changes", []), change_id, "Change")


@router.post("/auto")
async def auto_detect_changes(
    slug: str,
    task_id: str = Query("", description="Task ID for git diff"),
    storage=Depends(get_storage),
):
    """Auto-detect changes from git diff.

    Note: This is a placeholder. Full git integration requires
    shell access which should be handled by the orchestrator agent,
    not the API directly. Returns a stub response.
    """
    return {
        "message": "Auto-detect should be invoked via CLI: python -m core.changes diff",
        "task_id": task_id,
        "changes": [],
    }

"""Notifications router — CRUD with status lifecycle and bulk operations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

import asyncio

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

router = APIRouter(prefix="/projects/{slug}/notifications", tags=["notifications"])

VALID_TYPES = Literal["decision", "approval", "question", "alert"]
VALID_PRIORITIES = Literal["critical", "high", "normal", "low"]
VALID_STATUSES = Literal["UNREAD", "READ", "DISMISSED", "RESOLVED"]

# Status transition rules — DISMISSED and RESOLVED are terminal
_NOTIFICATION_TRANSITIONS: dict[str, set[str]] = {
    "UNREAD": {"READ", "DISMISSED", "RESOLVED"},
    "READ": {"DISMISSED", "RESOLVED"},
    "DISMISSED": set(),  # terminal
    "RESOLVED": set(),   # terminal
}

ENTITY = "notifications"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AiOption(BaseModel):
    label: str
    action: str
    reasoning: str = ""


class NotificationCreate(BaseModel):
    notification_type: VALID_TYPES
    priority: VALID_PRIORITIES = "normal"
    title: str
    message: str = ""
    source_event: str = ""
    source_entity_type: str = ""
    source_entity_id: str = ""
    workflow_id: str = ""
    workflow_step: str = ""
    ai_options: list[AiOption] = Field(default_factory=list)


class NotificationStatusUpdate(BaseModel):
    status: VALID_STATUSES


class NotificationRespond(BaseModel):
    response: str
    action: str = ""


class BulkStatusUpdate(BaseModel):
    status: VALID_STATUSES = "READ"
    notification_ids: list[str] | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _recount_unread(data: dict) -> None:
    """Recompute unread_count from notifications list."""
    data["unread_count"] = sum(
        1 for n in data.get("notifications", []) if n.get("status") == "UNREAD"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_notifications(
    slug: str,
    status: str | None = None,
    notification_type: str | None = None,
    priority: str | None = None,
    workflow_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, ENTITY)
    items = data.get("notifications", [])
    if status:
        items = [n for n in items if n.get("status") == status]
    if notification_type:
        items = [n for n in items if n.get("notification_type") == notification_type]
    if priority:
        items = [n for n in items if n.get("priority") == priority]
    if workflow_id:
        items = [n for n in items if n.get("workflow_id") == workflow_id]
    total = len(items)
    # Return newest first
    items = sorted(items, key=lambda n: n.get("created_at", ""), reverse=True)
    items = items[offset : offset + limit]
    return {"notifications": items, "total": total, "unread_count": data.get("unread_count", 0)}


@router.get("/unread-count")
async def get_unread_count(slug: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, ENTITY)
    return {"unread_count": data.get("unread_count", 0)}


@router.post("", status_code=201)
async def add_notifications(
    request: Request, slug: str, body: list[NotificationCreate], storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    ts = datetime.now(timezone.utc).isoformat()
    async with _get_lock(slug, ENTITY):
        data = await load_entity(storage, slug, ENTITY)
        notifications = data.get("notifications", [])
        added = []
        for item in body:
            nid = next_id(notifications, "N")
            notification = {
                "id": nid,
                **item.model_dump(),
                "status": "UNREAD",
                "project": slug,
                "response": None,
                "response_at": None,
                "created_at": ts,
                "resolved_at": None,
            }
            # Serialize ai_options to plain dicts
            notification["ai_options"] = [
                opt.model_dump() if hasattr(opt, "model_dump") else opt
                for opt in item.ai_options
            ]
            notifications.append(notification)
            added.append(nid)
        data["notifications"] = notifications
        _recount_unread(data)
        await save_entity(storage, slug, ENTITY, data)
    for i, nid in enumerate(added):
        item = body[i]
        await emit_event(request, slug, "notification.created", {
            "notification_id": nid,
            "notification_type": item.notification_type,
            "priority": item.priority,
            "title": item.title,
            "source_entity_type": item.source_entity_type,
            "source_entity_id": item.source_entity_id,
        })
    return {"added": added, "total": len(notifications), "unread_count": data.get("unread_count", 0)}


@router.get("/{notification_id}")
async def get_notification(slug: str, notification_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, ENTITY)
    return find_item_or_404(data.get("notifications", []), notification_id, "Notification")


@router.patch("/{notification_id}")
async def update_notification_status(
    request: Request, slug: str, notification_id: str,
    body: NotificationStatusUpdate, storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, ENTITY):
        data = await load_entity(storage, slug, ENTITY)
        notification = find_item_or_404(data.get("notifications", []), notification_id, "Notification")
        old_status = notification.get("status", "UNREAD")
        new_status = body.status
        allowed = _NOTIFICATION_TRANSITIONS.get(old_status, set())
        if new_status not in allowed:
            raise HTTPException(422, f"Invalid transition: {old_status} -> {new_status}")
        notification["status"] = new_status
        notification["updated_at"] = datetime.now(timezone.utc).isoformat()
        if new_status == "RESOLVED":
            notification["resolved_at"] = notification["updated_at"]
        _recount_unread(data)
        await save_entity(storage, slug, ENTITY, data)
    event_type = "notification.resolved" if new_status == "RESOLVED" else "notification.updated"
    await emit_event(request, slug, event_type, {
        "notification_id": notification_id,
        "old_status": old_status,
        "new_status": new_status,
    })
    return notification


@router.post("/{notification_id}/respond")
async def respond_to_notification(
    request: Request, slug: str, notification_id: str,
    body: NotificationRespond, storage=Depends(get_storage),
):
    """Respond to a blocking notification (decision, approval, question)."""
    await check_project_exists(storage, slug)
    ts = datetime.now(timezone.utc).isoformat()
    async with _get_lock(slug, ENTITY):
        data = await load_entity(storage, slug, ENTITY)
        notification = find_item_or_404(data.get("notifications", []), notification_id, "Notification")
        old_status = notification.get("status", "UNREAD")
        if old_status in ("DISMISSED", "RESOLVED"):
            raise HTTPException(422, f"Cannot respond to {old_status} notification")
        notification["response"] = body.response
        notification["response_at"] = ts
        notification["status"] = "RESOLVED"
        notification["resolved_at"] = ts
        notification["updated_at"] = ts
        if body.action:
            notification["response_action"] = body.action
        _recount_unread(data)
        await save_entity(storage, slug, ENTITY, data)
    await emit_event(request, slug, "notification.resolved", {
        "notification_id": notification_id,
        "response": body.response,
        "action": body.action,
        "notification_type": notification.get("notification_type"),
        "source_entity_id": notification.get("source_entity_id"),
    })
    return notification


@router.patch("/bulk")
async def bulk_update_status(
    request: Request, slug: str, body: BulkStatusUpdate, storage=Depends(get_storage),
):
    """Bulk status update — mark-all-read or update specific IDs."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, ENTITY):
        data = await load_entity(storage, slug, ENTITY)
        notifications = data.get("notifications", [])
        updated_ids = []
        ts = datetime.now(timezone.utc).isoformat()
        for n in notifications:
            # Filter by IDs if provided
            if body.notification_ids and n["id"] not in body.notification_ids:
                continue
            old_status = n.get("status", "UNREAD")
            allowed = _NOTIFICATION_TRANSITIONS.get(old_status, set())
            if body.status in allowed:
                n["status"] = body.status
                n["updated_at"] = ts
                if body.status == "RESOLVED":
                    n["resolved_at"] = ts
                updated_ids.append(n["id"])
        _recount_unread(data)
        await save_entity(storage, slug, ENTITY, data)
    if updated_ids:
        await emit_event(request, slug, "notification.updated", {
            "bulk": True,
            "updated_ids": updated_ids,
            "new_status": body.status,
        })
    return {"updated": updated_ids, "count": len(updated_ids), "unread_count": data.get("unread_count", 0)}


@router.delete("/{notification_id}")
async def remove_notification(
    slug: str, notification_id: str, request: Request, storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, ENTITY):
        data = await load_entity(storage, slug, ENTITY)
        notifications = data.get("notifications", [])
        notification = find_item_or_404(notifications, notification_id, "Notification")
        notifications.remove(notification)
        data["notifications"] = notifications
        _recount_unread(data)
        await save_entity(storage, slug, ENTITY, data)
    return {"removed": notification_id}


# ---------------------------------------------------------------------------
# Global router — cross-project notification count (D-015)
# ---------------------------------------------------------------------------

global_router = APIRouter(prefix="/notifications", tags=["notifications"])


@global_router.get("/global-count")
async def global_unread_count(storage=Depends(get_storage)):
    """Return unread notification counts across all projects."""
    projects = await asyncio.to_thread(storage.list_projects)
    results = []
    total = 0
    for slug in projects:
        exists = await asyncio.to_thread(storage.exists, slug, ENTITY)
        if not exists:
            continue
        data = await load_entity(storage, slug, ENTITY)
        count = data.get("unread_count", 0)
        if count > 0:
            results.append({"slug": slug, "unread_count": count})
            total += count
    return {"projects": results, "total": total}

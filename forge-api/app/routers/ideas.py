"""Ideas router — CRUD + hierarchy + commit."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
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

router = APIRouter(prefix="/projects/{slug}/ideas", tags=["ideas"])

IDEA_CATEGORIES = Literal[
    "feature", "improvement", "experiment", "migration",
    "refactor", "infrastructure", "business-opportunity", "research",
]

# Allowed status transitions for ideas
_IDEA_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"EXPLORING", "REJECTED"},
    "EXPLORING": {"APPROVED", "REJECTED", "DRAFT"},
    "APPROVED": set(),  # COMMITTED only via /commit endpoint
    "REJECTED": {"DRAFT"},  # allow reopen to draft
    "COMMITTED": set(),  # terminal
}


class IdeaCreate(BaseModel):
    title: str
    description: str = ""
    category: IDEA_CATEGORIES = "feature"
    priority: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    tags: list[str] = []
    related_ideas: list[str] = []
    guidelines: list[str] = []
    parent_id: str | None = None
    relations: list[dict] = []
    scopes: list[str] = []
    advances_key_results: list[str] = []
    knowledge_ids: list[str] = []


class IdeaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["DRAFT", "EXPLORING", "APPROVED", "REJECTED"] | None = None
    category: IDEA_CATEGORIES | None = None
    priority: Literal["HIGH", "MEDIUM", "LOW"] | None = None
    rejection_reason: str | None = None
    merged_into: str | None = None
    tags: list[str] | None = None
    related_ideas: list[str] | None = None
    guidelines: list[str] | None = None
    exploration_notes: str | None = None
    parent_id: str | None = None
    relations: list[dict] | None = None
    scopes: list[str] | None = None
    advances_key_results: list[str] | None = None
    knowledge_ids: list[str] | None = None


@router.get("")
async def list_ideas(
    slug: str,
    status: str | None = None,
    category: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "ideas")
    ideas = data.get("ideas", [])
    if status:
        ideas = [i for i in ideas if i.get("status") == status]
    if category:
        ideas = [i for i in ideas if i.get("category") == category]
    return {"ideas": ideas, "count": len(ideas)}


@router.post("", status_code=201)
async def create_ideas(slug: str, body: list[IdeaCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ideas"):
        data = await load_entity(storage, slug, "ideas")
        ideas = data.get("ideas", [])
        added = []
        for item in body:
            idea_id = next_id(ideas, "I")
            idea = {**item.model_dump(), "id": idea_id, "status": "DRAFT"}
            ideas.append(idea)
            added.append(idea_id)
        data["ideas"] = ideas
        await save_entity(storage, slug, "ideas", data)
    return {"added": added, "total": len(ideas)}


@router.get("/{idea_id}")
async def get_idea(slug: str, idea_id: str, storage=Depends(get_storage)):
    """Get idea detail — includes hierarchy and related decisions."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "ideas")
    idea = find_item_or_404(data.get("ideas", []), idea_id, "Idea")

    # Build hierarchy: children
    all_ideas = data.get("ideas", [])
    children = [i for i in all_ideas if i.get("parent_id") == idea_id]

    # Related decisions
    dec_data = await load_entity(storage, slug, "decisions")
    related_decisions = [
        d for d in dec_data.get("decisions", [])
        if d.get("task_id") == idea_id or d.get("linked_entity_id") == idea_id
    ]

    return {
        **idea,
        "children": [{"id": c["id"], "title": c.get("title", ""), "status": c.get("status", "")} for c in children],
        "related_decisions": related_decisions,
    }


@router.patch("/{idea_id}")
async def update_idea(slug: str, idea_id: str, body: IdeaUpdate, request: Request, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    updates = body.model_dump(exclude_none=True)
    # F-16: COMMITTED can only be set via /commit endpoint
    if updates.get("status") == "COMMITTED":
        raise HTTPException(422, "Use POST /{idea_id}/commit to set COMMITTED status")
    async with _get_lock(slug, "ideas"):
        data = await load_entity(storage, slug, "ideas")
        idea = find_item_or_404(data.get("ideas", []), idea_id, "Idea")
        old_status = idea.get("status", "DRAFT")
        # Validate status transition
        if "status" in updates:
            new_status = updates["status"]
            allowed = _IDEA_TRANSITIONS.get(old_status, set())
            if new_status not in allowed:
                raise HTTPException(422, f"Invalid transition: {old_status} -> {new_status}")
        for k, v in updates.items():
            idea[k] = v
        await save_entity(storage, slug, "ideas", data)
    if "status" in updates and updates["status"] != old_status:
        await emit_event(request, slug, "idea.status_changed", {
            "idea_id": idea_id, "old_status": old_status, "new_status": updates["status"],
        })
    return idea


@router.post("/{idea_id}/commit")
async def commit_idea(slug: str, idea_id: str, request: Request, storage=Depends(get_storage)):
    """Commit idea — transition to COMMITTED status (only from APPROVED)."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "ideas"):
        data = await load_entity(storage, slug, "ideas")
        idea = find_item_or_404(data.get("ideas", []), idea_id, "Idea")
        if idea.get("status") != "APPROVED":
            raise HTTPException(422, f"Can only commit APPROVED ideas, got '{idea.get('status')}'")
        idea["status"] = "COMMITTED"
        await save_entity(storage, slug, "ideas", data)
    await emit_event(request, slug, "idea.status_changed", {
        "idea_id": idea_id, "old_status": "APPROVED", "new_status": "COMMITTED",
    })
    return idea

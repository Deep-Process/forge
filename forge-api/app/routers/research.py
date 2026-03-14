"""Research router — CRUD + context loading for R-NNN research objects."""

from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{slug}/research", tags=["research"])

# --- Status transitions (from core.research contract) ---

VALID_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"ACTIVE", "ARCHIVED"},
    "ACTIVE": {"SUPERSEDED", "ARCHIVED"},
    "SUPERSEDED": {"ARCHIVED"},
    "ARCHIVED": set(),
}

ResearchCategory = Literal[
    "architecture", "business", "domain", "feasibility", "risk", "technical"
]
ResearchStatus = Literal["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"]


# --- Pydantic models ---


class ResearchCreate(BaseModel):
    title: str
    topic: str
    category: ResearchCategory
    summary: str
    linked_entity_type: Literal["objective", "idea"] | None = None
    linked_entity_id: str | None = None
    linked_idea_id: str | None = None
    skill: str | None = None
    file_path: str | None = None
    content: str | None = None
    key_findings: list[str] = []
    decision_ids: list[str] = []
    scopes: list[str] = []
    tags: list[str] = []
    created_by: str = "claude"


class ResearchUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None
    status: ResearchStatus | None = None
    category: ResearchCategory | None = None
    summary: str | None = None
    key_findings: list[str] | None = None
    decision_ids: list[str] | None = None
    file_path: str | None = None
    linked_idea_id: str | None = None
    scopes: list[str] | None = None
    tags: list[str] | None = None


# --- Endpoints ---


@router.get("")
async def list_research(
    slug: str,
    status: str | None = None,
    category: str | None = None,
    entity: str | None = None,
    storage=Depends(get_storage),
):
    """List research objects with optional filters."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "research")
    entries = data.get("research", [])

    if status:
        entries = [e for e in entries if e.get("status") == status]
    if category:
        entries = [e for e in entries if e.get("category") == category]
    if entity:
        entries = [
            e
            for e in entries
            if e.get("linked_entity_id") == entity
            or e.get("linked_idea_id") == entity
        ]

    return {"research": entries, "count": len(entries)}


@router.post("", status_code=201)
async def create_research(
    request: Request,
    slug: str,
    body: list[ResearchCreate],
    storage=Depends(get_storage),
):
    """Create one or more research objects."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "research"):
        data = await load_entity(storage, slug, "research")
        entries = data.get("research", [])
        added = []

        for item in body:
            r_id = next_id(entries, "R")
            entry = {**item.model_dump(), "id": r_id, "status": "DRAFT"}

            # Auto-generate file_path from skill + title if content provided
            if item.content and not item.file_path:
                slug_part = (
                    item.title.lower()
                    .replace(" ", "-")
                    .replace(":", "")
                    .replace("/", "-")[:60]
                )
                skill_part = item.skill or "research"
                entry["file_path"] = f"research/{skill_part}-{slug_part}.md"

            entries.append(entry)
            added.append(r_id)

        data["research"] = entries
        await save_entity(storage, slug, "research", data)

    for i, r_id in enumerate(added):
        item = body[i]
        await emit_event(
            request,
            slug,
            "research.created",
            {
                "research_id": r_id,
                "title": item.title,
                "category": item.category,
                "linked_entity_id": item.linked_entity_id,
            },
        )

    return {"added": added, "total": len(entries)}


@router.get("/context")
async def research_context(
    slug: str,
    entity: str,
    storage=Depends(get_storage),
):
    """Get research linked to a specific entity (for LLM context assembly)."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "research")
    entries = data.get("research", [])

    matching = [
        e
        for e in entries
        if e.get("linked_entity_id") == entity
        or e.get("linked_idea_id") == entity
    ]

    # Return condensed context: summary + key_findings + decision links
    context = []
    for r in matching:
        context.append(
            {
                "id": r["id"],
                "title": r.get("title", ""),
                "category": r.get("category", ""),
                "status": r.get("status", "DRAFT"),
                "summary": r.get("summary", ""),
                "key_findings": r.get("key_findings", []),
                "decision_ids": r.get("decision_ids", []),
                "file_path": r.get("file_path", ""),
                "skill": r.get("skill", ""),
            }
        )

    return {"research": context, "count": len(context), "entity": entity}


@router.get("/{research_id}")
async def get_research(
    slug: str, research_id: str, storage=Depends(get_storage)
):
    """Get a single research object by ID."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "research")
    return find_item_or_404(data.get("research", []), research_id, "Research")


@router.patch("/{research_id}")
async def update_research(
    request: Request,
    slug: str,
    research_id: str,
    body: ResearchUpdate,
    storage=Depends(get_storage),
):
    """Update a research object (status, decision_ids, etc.)."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "research"):
        data = await load_entity(storage, slug, "research")
        entry = find_item_or_404(
            data.get("research", []), research_id, "Research"
        )

        updates = body.model_dump(exclude_none=True)

        # Validate status transitions
        if "status" in updates:
            current = entry.get("status", "DRAFT")
            target = updates["status"]
            valid = VALID_TRANSITIONS.get(current, set())
            if target not in valid:
                raise HTTPException(
                    422,
                    f"Invalid status transition: {current} -> {target}. "
                    f"Valid: {', '.join(sorted(valid)) or 'none (terminal)'}",
                )

        old_status = entry.get("status")
        for k, v in updates.items():
            entry[k] = v

        await save_entity(storage, slug, "research", data)

    if "status" in updates:
        await emit_event(
            request,
            slug,
            "research.updated",
            {
                "research_id": research_id,
                "old_status": old_status,
                "new_status": updates["status"],
            },
        )
    else:
        await emit_event(
            request,
            slug,
            "research.updated",
            {
                "research_id": research_id,
                "fields": list(updates.keys()),
            },
        )

    return entry


@router.delete("/{research_id}")
async def remove_research(slug: str, research_id: str, request: Request, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "research"):
        data = await load_entity(storage, slug, "research")
        entries = data.get("research", [])
        entry = find_item_or_404(entries, research_id, "Research")
        entries.remove(entry)
        data["research"] = entries
        await save_entity(storage, slug, "research", data)
    await emit_event(request, slug, "research.removed", {"id": research_id})
    return {"removed": research_id}

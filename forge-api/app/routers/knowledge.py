"""Knowledge router — CRUD + versions + impact + link/unlink."""

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

router = APIRouter(prefix="/projects/{slug}/knowledge", tags=["knowledge"])

KNOWLEDGE_CATEGORIES = Literal[
    "domain-rules", "api-reference", "architecture", "business-context",
    "technical-context", "code-patterns", "integration", "infrastructure",
]
KNOWLEDGE_STATUSES = Literal["DRAFT", "ACTIVE", "REVIEW_NEEDED", "DEPRECATED", "ARCHIVED"]

# Valid status transitions (F-17)
VALID_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"ACTIVE", "ARCHIVED"},
    "ACTIVE": {"REVIEW_NEEDED", "DEPRECATED"},
    "REVIEW_NEEDED": {"ACTIVE", "DEPRECATED"},
    "DEPRECATED": {"ARCHIVED", "ACTIVE"},
    # ARCHIVED is terminal — no transitions
}

LINK_ENTITY_TYPES = Literal["task", "idea", "objective", "knowledge", "guideline", "lesson"]
LINK_RELATIONS = Literal["required", "context", "reference", "depends_on",
                          "references", "derived-from", "supports", "contradicts"]


class KnowledgeCreate(BaseModel):
    title: str
    category: KNOWLEDGE_CATEGORIES
    content: str
    scopes: list[str] = []
    tags: list[str] = []
    source: dict | None = None
    linked_entities: list[dict] = []
    dependencies: list[str] = []
    review_interval_days: int = 30
    created_by: Literal["user", "ai"] = "user"


class KnowledgeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: KNOWLEDGE_STATUSES | None = None
    category: KNOWLEDGE_CATEGORIES | None = None
    scopes: list[str] | None = None
    tags: list[str] | None = None
    source: dict | None = None
    dependencies: list[str] | None = None
    review_interval_days: int | None = None
    change_reason: str | None = None
    changed_by: Literal["user", "ai"] | None = None


class LinkCreate(BaseModel):
    entity_type: LINK_ENTITY_TYPES
    entity_id: str
    relation: LINK_RELATIONS = "reference"


@router.get("")
async def list_knowledge(
    slug: str,
    category: str | None = None,
    status: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entries = data.get("knowledge", [])
    if category:
        entries = [k for k in entries if k.get("category") == category]
    if status:
        entries = [k for k in entries if k.get("status") == status]
    return {"knowledge": entries, "count": len(entries)}


@router.post("", status_code=201)
async def create_knowledge(slug: str, body: list[KnowledgeCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "knowledge"):
        data = await load_entity(storage, slug, "knowledge")
        entries = data.get("knowledge", [])
        added = []
        for item in body:
            k_id = next_id(entries, "K")
            entry = {**item.model_dump(), "id": k_id, "status": "ACTIVE", "versions": []}
            entries.append(entry)
            added.append(k_id)
        data["knowledge"] = entries
        await save_entity(storage, slug, "knowledge", data)
    return {"added": added, "total": len(entries)}


@router.get("/{k_id}")
async def get_knowledge(slug: str, k_id: str, storage=Depends(get_storage)):
    """Get knowledge — latest version."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    return find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")


@router.patch("/{k_id}")
async def update_knowledge(request: Request, slug: str, k_id: str, body: KnowledgeUpdate, storage=Depends(get_storage)):
    """Update knowledge — creates new version if content changed."""
    await check_project_exists(storage, slug)

    async with _get_lock(slug, "knowledge"):
        data = await load_entity(storage, slug, "knowledge")
        entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")

        updates = body.model_dump(exclude_none=True)

        # F-17: Validate status transitions
        if "status" in updates:
            current = entry.get("status", "ACTIVE")
            target = updates["status"]
            valid = VALID_TRANSITIONS.get(current, set())
            if target not in valid:
                raise HTTPException(422, f"Invalid transition: {current} -> {target}")

        # If content is being changed, create a version snapshot
        if "content" in updates and updates["content"] != entry.get("content", ""):
            if not updates.get("change_reason"):
                raise HTTPException(422, "change_reason is required when updating content")
            versions = entry.get("versions", [])
            version_num = len(versions) + 1
            versions.append({
                "version": version_num,
                "content": entry.get("content", ""),
                "change_reason": updates.pop("change_reason", ""),
                "changed_by": updates.pop("changed_by", "user"),
            })
            entry["versions"] = versions

        # Remove version-tracking fields from direct updates
        updates.pop("change_reason", None)
        updates.pop("changed_by", None)

        for k, v in updates.items():
            entry[k] = v

        await save_entity(storage, slug, "knowledge", data)
    if "content" in body.model_dump(exclude_none=True):
        new_ver = len(entry.get("versions", []))
        await emit_event(request, slug, "knowledge.updated", {
            "knowledge_id": k_id, "new_version": new_ver,
        })
    return entry


@router.get("/{k_id}/versions")
async def list_versions(slug: str, k_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")
    versions = entry.get("versions", [])
    return {"versions": versions, "count": len(versions)}


@router.get("/{k_id}/versions/{version}")
async def get_version(slug: str, k_id: str, version: int, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")
    versions = entry.get("versions", [])
    for v in versions:
        if v.get("version") == version:
            return v
    raise HTTPException(404, f"Version {version} not found for {k_id}")


@router.get("/{k_id}/impact")
async def impact_analysis(slug: str, k_id: str, storage=Depends(get_storage)):
    """Impact analysis — entities affected by this knowledge."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "knowledge")
    entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")

    # Gather all entities that reference this knowledge
    affected = []

    # Check tasks
    tracker = await load_entity(storage, slug, "tracker")
    for t in tracker.get("tasks", []):
        if k_id in t.get("knowledge_ids", []):
            affected.append({"entity_type": "task", "entity_id": t["id"], "name": t.get("name", "")})

    # Check ideas
    ideas_data = await load_entity(storage, slug, "ideas")
    for i in ideas_data.get("ideas", []):
        if k_id in i.get("knowledge_ids", []):
            affected.append({"entity_type": "idea", "entity_id": i["id"], "name": i.get("title", "")})

    # Check objectives
    obj_data = await load_entity(storage, slug, "objectives")
    for o in obj_data.get("objectives", []):
        if k_id in o.get("knowledge_ids", []):
            affected.append({"entity_type": "objective", "entity_id": o["id"], "name": o.get("title", "")})

    # Check linked_entities on the knowledge itself
    for le in entry.get("linked_entities", []):
        already = any(a["entity_id"] == le.get("entity_id") for a in affected)
        if not already:
            affected.append({
                "entity_type": le.get("entity_type", ""),
                "entity_id": le.get("entity_id", ""),
                "relation": le.get("relation", ""),
            })

    return {
        "knowledge_id": k_id,
        "title": entry.get("title", ""),
        "total_affected": len(affected),
        "affected_entities": affected,
    }


@router.post("/{k_id}/link", status_code=201)
async def link_entity(slug: str, k_id: str, body: LinkCreate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "knowledge"):
        data = await load_entity(storage, slug, "knowledge")
        entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")
        linked = entry.get("linked_entities", [])

        # Check for duplicate
        for le in linked:
            if le.get("entity_type") == body.entity_type and le.get("entity_id") == body.entity_id:
                raise HTTPException(409, f"Link to {body.entity_type}:{body.entity_id} already exists")

        # F-13: Safe link_id generation
        max_id = max((le.get("link_id", 0) for le in linked), default=0)
        link = body.model_dump()
        link["link_id"] = max_id + 1
        linked.append(link)
        entry["linked_entities"] = linked

        await save_entity(storage, slug, "knowledge", data)
    return link


@router.delete("/{k_id}/link/{link_id}")
async def unlink_entity(slug: str, k_id: str, link_id: int, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "knowledge"):
        data = await load_entity(storage, slug, "knowledge")
        entry = find_item_or_404(data.get("knowledge", []), k_id, "Knowledge")
        linked = entry.get("linked_entities", [])

        for i, le in enumerate(linked):
            if le.get("link_id") == link_id:
                linked.pop(i)
                entry["linked_entities"] = linked
                await save_entity(storage, slug, "knowledge", data)
                return {"removed": link_id}

    raise HTTPException(404, f"Link {link_id} not found")

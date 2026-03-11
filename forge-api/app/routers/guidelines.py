"""Guidelines router — CRUD + context for LLM."""

from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    find_item_or_404,
    load_entity,
    next_id,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/guidelines", tags=["guidelines"])


class GuidelineCreate(BaseModel):
    title: str
    scope: str
    content: str
    rationale: str = ""
    examples: list[str] = []
    tags: list[str] = []
    weight: Literal["must", "should", "may"] = "should"


class GuidelineUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: Literal["ACTIVE", "DEPRECATED"] | None = None
    rationale: str | None = None
    scope: str | None = None
    examples: list[str] | None = None
    tags: list[str] | None = None
    weight: Literal["must", "should", "may"] | None = None
    derived_from: str | None = None


@router.get("")
async def list_guidelines(
    slug: str,
    status: str | None = None,
    scope: str | None = None,
    weight: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "guidelines")
    guidelines = data.get("guidelines", [])
    if status:
        guidelines = [g for g in guidelines if g.get("status") == status]
    if scope:
        guidelines = [g for g in guidelines if g.get("scope") == scope]
    if weight:
        guidelines = [g for g in guidelines if g.get("weight") == weight]
    return {"guidelines": guidelines, "count": len(guidelines)}


@router.post("", status_code=201)
async def create_guidelines(slug: str, body: list[GuidelineCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "guidelines"):
        data = await load_entity(storage, slug, "guidelines")
        guidelines = data.get("guidelines", [])
        added = []
        for item in body:
            g_id = next_id(guidelines, "G")
            guideline = {**item.model_dump(), "id": g_id, "status": "ACTIVE"}
            guidelines.append(guideline)
            added.append(g_id)
        data["guidelines"] = guidelines
        await save_entity(storage, slug, "guidelines", data)
    return {"added": added, "total": len(guidelines)}


# Static routes BEFORE parameterized routes (F-03)
@router.get("/context")
async def guidelines_context(
    slug: str,
    scopes: str = Query("", description="Comma-separated scopes to filter by"),
    storage=Depends(get_storage),
):
    """Get guidelines formatted for LLM context, filtered by scopes."""
    await check_project_exists(storage, slug)

    # Load project guidelines
    data = await load_entity(storage, slug, "guidelines")
    project_guidelines = [g for g in data.get("guidelines", []) if g.get("status") == "ACTIVE"]

    # Load global guidelines (F-07)
    g_data = await asyncio.to_thread(storage.load_global, "guidelines")
    global_guidelines = [g for g in g_data.get("guidelines", []) if g.get("status") == "ACTIVE"]

    # Merge: global + project
    guidelines = global_guidelines + project_guidelines

    if scopes:
        scope_set = {s.strip() for s in scopes.split(",") if s.strip()}
        guidelines = [g for g in guidelines if g.get("scope") in scope_set]

    # Group by weight
    must = [g for g in guidelines if g.get("weight") == "must"]
    should = [g for g in guidelines if g.get("weight") == "should"]
    may = [g for g in guidelines if g.get("weight") == "may"]

    return {
        "must": must,
        "should": should,
        "may": may,
        "total": len(guidelines),
    }


@router.get("/{guideline_id}")
async def get_guideline(slug: str, guideline_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "guidelines")
    return find_item_or_404(data.get("guidelines", []), guideline_id, "Guideline")


@router.patch("/{guideline_id}")
async def update_guideline(slug: str, guideline_id: str, body: GuidelineUpdate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "guidelines"):
        data = await load_entity(storage, slug, "guidelines")
        guideline = find_item_or_404(data.get("guidelines", []), guideline_id, "Guideline")
        updates = body.model_dump(exclude_none=True)
        # Block content changes on DEPRECATED guidelines (only status changes allowed)
        if guideline.get("status") == "DEPRECATED" and set(updates.keys()) - {"status"}:
            raise HTTPException(422, "Cannot modify DEPRECATED guideline fields — only status changes allowed")
        for k, v in updates.items():
            guideline[k] = v
        await save_entity(storage, slug, "guidelines", data)
    return guideline

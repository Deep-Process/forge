"""Objectives router — CRUD + coverage dashboard."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    find_item_or_404,
    load_entity,
    next_id,
    save_entity,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{slug}/objectives", tags=["objectives"])


class ObjectiveCreate(BaseModel):
    title: str
    description: str
    key_results: list[dict]
    appetite: Literal["small", "medium", "large"] = "medium"
    scope: Literal["project", "cross-project"] = "project"
    assumptions: list[str] = []
    tags: list[str] = []
    scopes: list[str] = []
    derived_guidelines: list[str] = []
    knowledge_ids: list[str] = []
    guideline_ids: list[str] = []
    relations: list[dict] = []

    @field_validator("key_results")
    @classmethod
    def validate_key_results(cls, v):
        if not v:
            raise ValueError("At least one key_result is required")
        for i, kr in enumerate(v):
            has_metric = bool(kr.get("metric")) and kr.get("target") is not None
            has_description = bool(kr.get("description"))
            if not has_metric and not has_description:
                raise ValueError(
                    f"key_result[{i}] must have either ('metric' + 'target') or 'description'"
                )
        return v

    @field_validator("relations")
    @classmethod
    def validate_relations(cls, v):
        valid_types = {"depends_on", "related_to", "supersedes", "duplicates"}
        for i, rel in enumerate(v):
            if rel.get("type") not in valid_types:
                raise ValueError(
                    f"relation[{i}].type must be one of: {', '.join(sorted(valid_types))}"
                )
            if not rel.get("target_id"):
                raise ValueError(f"relation[{i}].target_id is required")
        return v


class ObjectiveUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["ACTIVE", "ACHIEVED", "ABANDONED", "PAUSED"] | None = None
    appetite: Literal["small", "medium", "large"] | None = None
    assumptions: list[str] | None = None
    tags: list[str] | None = None
    key_results: list[dict] | None = None
    scopes: list[str] | None = None
    derived_guidelines: list[str] | None = None
    knowledge_ids: list[str] | None = None
    guideline_ids: list[str] | None = None
    relations: list[dict] | None = None


VALID_RELATION_TYPES = {"depends_on", "related_to", "supersedes", "duplicates"}


def _detect_cycle(objectives: list[dict], obj_id: str, relations: list[dict]) -> str | None:
    """DFS cycle detection for depends_on relations. Returns cycle path or None."""
    # Build adjacency graph from all objectives
    graph: dict[str, list[str]] = {}
    for obj in objectives:
        oid = obj.get("id", "")
        deps = [r["target_id"] for r in obj.get("relations", []) if r.get("type") == "depends_on"]
        graph[oid] = deps

    # Apply new relations for obj_id
    new_deps = [r["target_id"] for r in relations if r.get("type") == "depends_on"]
    graph[obj_id] = new_deps

    # DFS from obj_id to detect cycles
    visited: set[str] = set()
    path: list[str] = []

    def dfs(node: str) -> bool:
        if node in visited:
            return False
        if node in path:
            return True  # cycle
        path.append(node)
        for neighbor in graph.get(node, []):
            if dfs(neighbor):
                return True
        path.remove(node)
        visited.add(node)
        return False

    if dfs(obj_id):
        return " → ".join(path + [path[0]] if path else [])
    return None


def _validate_guideline_ids(guideline_ids: list[str], guidelines_data: dict) -> list[str]:
    """Validate guideline_ids exist. Returns list of warnings for missing ones."""
    if not guideline_ids:
        return []
    existing = {g["id"] for g in guidelines_data.get("guidelines", [])}
    warnings = []
    for gid in guideline_ids:
        if gid not in existing:
            warnings.append(f"Guideline {gid} not found in project")
    return warnings


@router.get("")
async def list_objectives(
    slug: str,
    status: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "objectives")
    objectives = data.get("objectives", [])
    if status:
        objectives = [o for o in objectives if o.get("status") == status]
    return {"objectives": objectives, "count": len(objectives)}


@router.post("", status_code=201)
async def create_objectives(slug: str, body: list[ObjectiveCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "objectives"):
        data = await load_entity(storage, slug, "objectives")
        objectives = data.get("objectives", [])
        guidelines_data = await load_entity(storage, slug, "guidelines")
        added = []
        warnings = []
        for item in body:
            obj_id = next_id(objectives, "O")
            obj = {**item.model_dump(), "id": obj_id, "status": "ACTIVE"}

            # Cycle detection for depends_on relations
            if item.relations:
                cycle = _detect_cycle(objectives, obj_id, item.relations)
                if cycle:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Cycle detected in depends_on relations: {cycle}",
                    )

            # Guideline_ids validation (warn, don't reject)
            if item.guideline_ids:
                gw = _validate_guideline_ids(item.guideline_ids, guidelines_data)
                warnings.extend(gw)
                for w in gw:
                    logger.warning(f"[{slug}] {obj_id}: {w}")

            objectives.append(obj)
            added.append(obj_id)
        data["objectives"] = objectives
        await save_entity(storage, slug, "objectives", data)
    result = {"added": added, "total": len(objectives)}
    if warnings:
        result["warnings"] = warnings
    return result


@router.get("/status")
async def objectives_coverage(slug: str, storage=Depends(get_storage)):
    """Coverage dashboard — KR progress, alignment."""
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "objectives")
    objectives = data.get("objectives", [])

    # Load ideas and tasks for alignment
    ideas_data = await load_entity(storage, slug, "ideas")
    tracker = await load_entity(storage, slug, "tracker")

    ideas = ideas_data.get("ideas", [])
    tasks = tracker.get("tasks", [])

    results = []
    for obj in objectives:
        obj_id = obj["id"]
        krs = obj.get("key_results", [])

        # Calculate KR progress
        kr_progress = []
        for kr in krs:
            if kr.get("metric"):
                baseline = kr.get("baseline", 0)
                target = kr.get("target", 0)
                current = kr.get("current", baseline)
                span = target - baseline
                pct = round((current - baseline) / span * 100, 1) if span else 0
                kr_progress.append({
                    "type": "numeric",
                    "metric": kr.get("metric", ""),
                    "baseline": baseline,
                    "target": target,
                    "current": current,
                    "progress_pct": min(max(pct, 0), 100),
                })
            else:
                kr_progress.append({
                    "type": "descriptive",
                    "description": kr.get("description", ""),
                    "status": kr.get("status", "NOT_STARTED"),
                })

        # Count aligned ideas and tasks
        aligned_ideas = [i for i in ideas if any(
            akr.startswith(f"{obj_id}/") for akr in i.get("advances_key_results", [])
        )]
        aligned_task_ids = set()
        for idea in aligned_ideas:
            for t in tasks:
                if t.get("origin_idea_id") == idea.get("id"):
                    aligned_task_ids.add(t["id"])

        results.append({
            "id": obj_id,
            "title": obj.get("title", ""),
            "status": obj.get("status", "ACTIVE"),
            "key_results": kr_progress,
            "aligned_ideas": len(aligned_ideas),
            "aligned_tasks": len(aligned_task_ids),
        })

    return {"objectives": results, "count": len(results)}


@router.get("/{obj_id}")
async def get_objective(slug: str, obj_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "objectives")
    return find_item_or_404(data.get("objectives", []), obj_id, "Objective")


@router.patch("/{obj_id}")
async def update_objective(slug: str, obj_id: str, body: ObjectiveUpdate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "objectives"):
        data = await load_entity(storage, slug, "objectives")
        objectives = data.get("objectives", [])
        obj = find_item_or_404(objectives, obj_id, "Objective")
        updates = body.model_dump(exclude_none=True)

        warnings = []

        # Cycle detection if relations are being updated
        if "relations" in updates:
            cycle = _detect_cycle(objectives, obj_id, updates["relations"])
            if cycle:
                raise HTTPException(
                    status_code=422,
                    detail=f"Cycle detected in depends_on relations: {cycle}",
                )

        # Guideline_ids validation
        if "guideline_ids" in updates:
            guidelines_data = await load_entity(storage, slug, "guidelines")
            gw = _validate_guideline_ids(updates["guideline_ids"], guidelines_data)
            warnings.extend(gw)

        for k, v in updates.items():
            obj[k] = v
        await save_entity(storage, slug, "objectives", data)

    result = dict(obj)
    if warnings:
        result["warnings"] = warnings
    return result

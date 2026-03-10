"""Gates router — show, configure, run checks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    load_entity,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/gates", tags=["gates"])


class GateConfig(BaseModel):
    name: str
    command: str
    required: bool = True


@router.get("")
async def show_gates(slug: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    tracker = await load_entity(storage, slug, "tracker")
    gates = tracker.get("gates", [])
    return {"gates": gates, "count": len(gates)}


@router.post("", status_code=201)
async def configure_gates(slug: str, body: list[GateConfig], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        tracker["gates"] = [g.model_dump() for g in body]
        await save_entity(storage, slug, "tracker", tracker)
    return {"configured": len(body)}


@router.post("/check")
async def run_gates(
    slug: str,
    task: str = Query("", description="Task ID to run gates for"),
    storage=Depends(get_storage),
):
    """Run all configured gates for a task.

    Note: Gate execution requires shell access and should be invoked
    via CLI: python -m core.gates check {project} --task {task_id}.
    This endpoint returns the gate configuration for the orchestrator
    to execute.
    """
    await check_project_exists(storage, slug)
    tracker = await load_entity(storage, slug, "tracker")
    gates = tracker.get("gates", [])

    if not gates:
        return {
            "message": "No gates configured",
            "task": task,
            "gates": [],
        }

    return {
        "message": "Gates should be executed via CLI: python -m core.gates check",
        "task": task,
        "gates": gates,
    }

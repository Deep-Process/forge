"""Tasks router — CRUD + next (claim) + complete + context assembly."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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

router = APIRouter(prefix="/projects/{slug}/tasks", tags=["tasks"])

CLAIM_WAIT_SECONDS = 1.0


class TaskCreate(BaseModel):
    name: str
    description: str = ""
    instruction: str = ""
    type: str = "feature"
    depends_on: list[str] = []
    blocked_by_decisions: list[str] = []
    conflicts_with: list[str] = []
    acceptance_criteria: list = []
    scopes: list[str] = []
    parallel: bool = False
    skill: str | None = None


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instruction: str | None = None
    status: str | None = None
    failed_reason: str | None = None
    blocked_by_decisions: list[str] | None = None


class TaskComplete(BaseModel):
    reasoning: str = ""


@router.get("")
async def list_tasks(
    slug: str,
    status: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    tracker = await load_entity(storage, slug, "tracker")
    tasks = tracker.get("tasks", [])
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    return {"tasks": tasks, "count": len(tasks)}


@router.post("", status_code=201)
async def add_tasks(slug: str, body: list[TaskCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        tasks = tracker.get("tasks", [])
        added = []
        for item in body:
            task_id = next_id(tasks, "T")
            task = {
                "id": task_id,
                "name": item.name,
                "description": item.description,
                "instruction": item.instruction,
                "type": item.type,
                "status": "TODO",
                "depends_on": item.depends_on,
                "blocked_by_decisions": item.blocked_by_decisions,
                "conflicts_with": item.conflicts_with,
                "acceptance_criteria": item.acceptance_criteria,
                "scopes": item.scopes,
                "parallel": item.parallel,
                "skill": item.skill,
            }
            tasks.append(task)
            added.append(task_id)
        tracker["tasks"] = tasks
        await save_entity(storage, slug, "tracker", tracker)
    return {"added": added, "total": len(tasks)}


@router.get("/{task_id}")
async def get_task(slug: str, task_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    tracker = await load_entity(storage, slug, "tracker")
    return find_item_or_404(tracker.get("tasks", []), task_id, "Task")


@router.patch("/{task_id}")
async def update_task(request: Request, slug: str, task_id: str, body: TaskUpdate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        task = find_item_or_404(tracker.get("tasks", []), task_id, "Task")
        old_status = task.get("status")
        updates = body.model_dump(exclude_none=True)
        for k, v in updates.items():
            task[k] = v
        await save_entity(storage, slug, "tracker", tracker)
    if "status" in updates and updates["status"] != old_status:
        await emit_event(request, slug, "task.status_changed", {
            "task_id": task_id, "old_status": old_status, "new_status": updates["status"],
        })
    return task


@router.delete("/{task_id}")
async def remove_task(slug: str, task_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        tasks = tracker.get("tasks", [])
        task = find_item_or_404(tasks, task_id, "Task")
        if task.get("status") != "TODO":
            raise HTTPException(422, f"Can only remove TODO tasks, '{task_id}' is {task.get('status')}")
        # Check no other task depends on this
        for t in tasks:
            if task_id in t.get("depends_on", []):
                raise HTTPException(422, f"Task {t['id']} depends on {task_id}")
        tasks.remove(task)
        tracker["tasks"] = tasks
        await save_entity(storage, slug, "tracker", tracker)
    return {"removed": task_id}


@router.post("/next")
async def claim_next_task(
    request: Request,
    slug: str,
    agent: str | None = Query(None),
    storage=Depends(get_storage),
):
    """Claim the next available task (two-phase claim)."""
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        tasks = tracker.get("tasks", [])

        done_ids = {t["id"] for t in tasks if t.get("status") == "DONE"}
        active_ids = {t["id"] for t in tasks if t.get("status") in ("IN_PROGRESS", "CLAIMING")}
        active_conflicts = set()
        for t in tasks:
            if t["id"] in active_ids:
                active_conflicts.update(t.get("conflicts_with", []))

        # Load decisions for blocked_by_decisions check (F-05)
        dec_data = await load_entity(storage, slug, "decisions")
        closed_decisions = {d["id"] for d in dec_data.get("decisions", []) if d.get("status") == "CLOSED"}

        claimed_id = None
        for task in tasks:
            if task.get("status") != "TODO":
                continue
            deps = set(task.get("depends_on", []))
            if not deps.issubset(done_ids):
                continue
            if task["id"] in active_conflicts:
                continue
            # Check blocked_by_decisions
            blocked = set(task.get("blocked_by_decisions", []))
            if blocked and not blocked.issubset(closed_decisions):
                continue

            # Phase 1: CLAIMING (only one task)
            task["status"] = "CLAIMING"
            if agent:
                task["agent"] = agent
            await save_entity(storage, slug, "tracker", tracker)
            claimed_id = task["id"]
            break

    if claimed_id is None:
        raise HTTPException(404, "No available tasks")

    # Wait for claim period
    await asyncio.sleep(CLAIM_WAIT_SECONDS)

    # Phase 2: verify and promote
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        tasks = tracker.get("tasks", [])
        task = find_item_or_404(tasks, claimed_id, "Task")

        if task.get("status") != "CLAIMING":
            raise HTTPException(409, f"Task {claimed_id} was claimed by another agent")
        if agent and task.get("agent") != agent:
            raise HTTPException(409, f"Task {claimed_id} was claimed by another agent")

        task["status"] = "IN_PROGRESS"
        await save_entity(storage, slug, "tracker", tracker)
        await emit_event(request, slug, "task.status_changed", {
            "task_id": claimed_id, "old_status": "TODO", "new_status": "IN_PROGRESS",
            "agent": agent,
        })
        return task


@router.post("/{task_id}/complete")
async def complete_task(
    request: Request,
    slug: str,
    task_id: str,
    body: TaskComplete | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "tracker"):
        tracker = await load_entity(storage, slug, "tracker")
        task = find_item_or_404(tracker.get("tasks", []), task_id, "Task")
        old_status = task.get("status")
        if old_status not in ("IN_PROGRESS", "CLAIMING"):
            raise HTTPException(422, f"Task must be IN_PROGRESS, is {old_status}")
        task["status"] = "DONE"
        await save_entity(storage, slug, "tracker", tracker)
    await emit_event(request, slug, "task.status_changed", {
        "task_id": task_id, "old_status": old_status, "new_status": "DONE",
    })
    return task


@router.get("/{task_id}/context")
async def get_task_context(slug: str, task_id: str, storage=Depends(get_storage)):
    """Assemble context for task execution."""
    await check_project_exists(storage, slug)
    tracker = await load_entity(storage, slug, "tracker")
    task = find_item_or_404(tracker.get("tasks", []), task_id, "Task")

    # Gather dependency outputs
    dep_tasks = []
    for dep_id in task.get("depends_on", []):
        dep = next((t for t in tracker.get("tasks", []) if t["id"] == dep_id), None)
        if dep:
            dep_tasks.append({"id": dep["id"], "name": dep.get("name", ""), "status": dep.get("status", "")})

    return {
        "task": task,
        "dependencies": dep_tasks,
        "scopes": task.get("scopes", []),
    }

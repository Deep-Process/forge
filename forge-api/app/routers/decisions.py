"""Decisions router — CRUD."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

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

router = APIRouter(prefix="/projects/{slug}/decisions", tags=["decisions"])

VALID_TYPES = Literal[
    "architecture", "implementation", "dependency", "security",
    "performance", "testing", "naming", "convention", "constraint",
    "business", "strategy", "other", "exploration", "risk",
]
VALID_CONFIDENCE = Literal["HIGH", "MEDIUM", "LOW"]
VALID_STATUS = Literal["OPEN", "CLOSED", "DEFERRED", "ANALYZING", "MITIGATED", "ACCEPTED"]

# Allowed status transitions for decisions
_DECISION_TRANSITIONS: dict[str, set[str]] = {
    "OPEN": {"CLOSED", "DEFERRED", "ANALYZING"},
    "ANALYZING": {"OPEN", "CLOSED", "DEFERRED", "MITIGATED", "ACCEPTED"},
    "DEFERRED": {"OPEN", "CLOSED"},
    "MITIGATED": {"CLOSED"},
    "ACCEPTED": {"CLOSED"},
    "CLOSED": set(),  # terminal
}


class DecisionCreate(BaseModel):
    task_id: str
    type: VALID_TYPES = "architecture"
    issue: str
    recommendation: str
    reasoning: str = ""
    alternatives: list[str] = []
    confidence: VALID_CONFIDENCE = "MEDIUM"
    status: VALID_STATUS = "OPEN"  # ignored — always forced to OPEN
    decided_by: Literal["claude", "user", "imported"] = "claude"
    file: str = ""
    scope: str = ""
    tags: list[str] = []
    # Exploration fields
    exploration_type: str = ""
    findings: list = []
    options: list = []
    open_questions: list[str] = []
    blockers: list[str] = []
    ready_for_tracker: bool = False
    evidence_refs: list[str] = []
    # Risk fields
    severity: str = ""
    likelihood: str = ""
    mitigation_plan: str = ""
    resolution_notes: str = ""
    linked_entity_type: str = ""
    linked_entity_id: str = ""


class DecisionUpdate(BaseModel):
    # Core fields
    status: VALID_STATUS | None = None
    task_id: str | None = None
    issue: str | None = None
    recommendation: str | None = None
    reasoning: str | None = None
    alternatives: list[str] | None = None
    confidence: VALID_CONFIDENCE | None = None
    decided_by: Literal["claude", "user", "imported"] | None = None
    file: str | None = None
    scope: str | None = None
    tags: list[str] | None = None
    resolution_notes: str | None = None
    evidence_refs: list[str] | None = None
    # Linked entity (generic — all decision types)
    linked_entity_type: str | None = None
    linked_entity_id: str | None = None
    # Risk fields
    severity: str | None = None
    likelihood: str | None = None
    mitigation_plan: str | None = None
    # Exploration fields
    exploration_type: str | None = None
    open_questions: list[str] | None = None
    blockers: list[str] | None = None


@router.get("")
async def list_decisions(
    slug: str,
    status: str | None = None,
    type: str | None = None,
    task_id: str | None = None,
    storage=Depends(get_storage),
):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "decisions")
    decisions = data.get("decisions", [])
    if status:
        decisions = [d for d in decisions if d.get("status") == status]
    if type:
        decisions = [d for d in decisions if d.get("type") == type]
    if task_id:
        decisions = [d for d in decisions if d.get("task_id") == task_id]
    return {"decisions": decisions, "count": len(decisions)}


@router.post("", status_code=201)
async def add_decisions(request: Request, slug: str, body: list[DecisionCreate], storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "decisions"):
        data = await load_entity(storage, slug, "decisions")
        decisions = data.get("decisions", [])
        added = []
        for item in body:
            decision_id = next_id(decisions, "D")
            decision = {"id": decision_id, **item.model_dump(), "status": "OPEN"}
            decisions.append(decision)
            added.append(decision_id)
        data["decisions"] = decisions
        await save_entity(storage, slug, "decisions", data)
    for i, d_id in enumerate(added):
        item = body[i]
        await emit_event(request, slug, "decision.created", {
            "decision_id": d_id, "type": item.type, "issue": item.issue,
        })
    return {"added": added, "total": len(decisions)}


@router.get("/{decision_id}")
async def get_decision(slug: str, decision_id: str, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    data = await load_entity(storage, slug, "decisions")
    return find_item_or_404(data.get("decisions", []), decision_id, "Decision")


@router.patch("/{decision_id}")
async def update_decision(request: Request, slug: str, decision_id: str, body: DecisionUpdate, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "decisions"):
        data = await load_entity(storage, slug, "decisions")
        decision = find_item_or_404(data.get("decisions", []), decision_id, "Decision")
        updates = body.model_dump(exclude_none=True)
        # Validate status transition
        if "status" in updates:
            old_status = decision.get("status", "OPEN")
            new_status = updates["status"]
            allowed = _DECISION_TRANSITIONS.get(old_status, set())
            if new_status not in allowed:
                raise HTTPException(422, f"Invalid transition: {old_status} -> {new_status}")
        for k, v in updates.items():
            decision[k] = v
        decision["updated_at"] = datetime.now(timezone.utc).isoformat()
        await save_entity(storage, slug, "decisions", data)
    if body.status == "CLOSED":
        await emit_event(request, slug, "decision.closed", {
            "decision_id": decision_id, "resolution": decision.get("recommendation", ""),
        })
    else:
        await emit_event(request, slug, "decision.updated", {
            "decision_id": decision_id, "fields": list(updates.keys()),
        })
    return decision


@router.delete("/{decision_id}")
async def remove_decision(slug: str, decision_id: str, request: Request, storage=Depends(get_storage)):
    await check_project_exists(storage, slug)
    async with _get_lock(slug, "decisions"):
        data = await load_entity(storage, slug, "decisions")
        decisions = data.get("decisions", [])
        decision = find_item_or_404(decisions, decision_id, "Decision")
        decisions.remove(decision)
        data["decisions"] = decisions
        await save_entity(storage, slug, "decisions", data)
    await emit_event(request, slug, "decision.removed", {"id": decision_id})
    return {"removed": decision_id}

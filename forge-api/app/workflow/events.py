"""Workflow event types and emission helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.events import EventBus


# ---------------------------------------------------------------------------
# Workflow event type constants
# ---------------------------------------------------------------------------

class WorkflowEventType:
    STARTED = "workflow.started"
    STEP_STARTED = "workflow.step_started"
    STEP_COMPLETED = "workflow.step_completed"
    PAUSED = "workflow.paused"
    RESUMED = "workflow.resumed"
    COMPLETED = "workflow.completed"
    FAILED = "workflow.failed"
    CANCELLED = "workflow.cancelled"


ALL_WORKFLOW_EVENT_TYPES = {
    WorkflowEventType.STARTED,
    WorkflowEventType.STEP_STARTED,
    WorkflowEventType.STEP_COMPLETED,
    WorkflowEventType.PAUSED,
    WorkflowEventType.RESUMED,
    WorkflowEventType.COMPLETED,
    WorkflowEventType.FAILED,
    WorkflowEventType.CANCELLED,
}


# ---------------------------------------------------------------------------
# Event payload model
# ---------------------------------------------------------------------------

class WorkflowEventPayload(BaseModel):
    """Payload for workflow events — serialized to JSON for WebSocket."""

    workflow_def_id: str
    execution_id: str  # ext_id (WE-001)
    step_id: str | None = None
    status: str  # execution or step status
    output_summary: str | None = None
    error: str | None = None
    pause_reason: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Emission helper
# ---------------------------------------------------------------------------

async def emit_workflow_event(
    event_bus: EventBus,
    project_slug: str,
    event_type: str,
    *,
    workflow_def_id: str,
    execution_id: str,
    step_id: str | None = None,
    status: str,
    output_summary: str | None = None,
    error: str | None = None,
    pause_reason: str | None = None,
) -> int:
    """Emit a workflow event via EventBus.

    Returns number of subscribers that received the message.
    """
    payload = WorkflowEventPayload(
        workflow_def_id=workflow_def_id,
        execution_id=execution_id,
        step_id=step_id,
        status=status,
        output_summary=output_summary,
        error=error,
        pause_reason=pause_reason,
    )
    return await event_bus.emit(
        project_slug,
        event_type,
        payload.model_dump(mode="json"),
    )

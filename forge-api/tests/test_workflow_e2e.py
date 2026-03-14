"""End-to-end workflow integration tests (T-069).

Tests cover:
- AC1: WorkflowEngine initializes and recovers stale executions
- AC2: Multi-step workflow executes end-to-end (KR-1)
- AC3: Workflow pauses on user_decision and resumes (KR-2)
- AC4: 3 concurrent workflows run independently (KR-3)
- AC5: Step transitions emit events (KR-4)
- AC6: Step timeout triggers graceful failure
- AC7: Engine recovery marks stale as failed
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone

import pytest

from app.events import EventBus
from app.workflow.engine import WorkflowEngine
from app.workflow.events import ALL_WORKFLOW_EVENT_TYPES, WorkflowEventType
from app.workflow.models import (
    ExecutionStatus,
    StepDefinition,
    StepStatus,
    StepType,
    WorkflowDefinition,
)
from app.workflow.steps import (
    ForgeCommandStepExecutor,
    StepContext,
    StepExecutor,
    UserDecisionStepExecutor,
)
from app.workflow.store import WorkflowStore


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def make_test_definition(
    def_id: str = "test-workflow",
    steps: list[StepDefinition] | None = None,
) -> WorkflowDefinition:
    """Create a simple test workflow definition."""
    if steps is None:
        steps = [
            StepDefinition(
                id="step-1",
                name="Step One",
                type=StepType.forge_command,
                description="First step",
                command_template="core.pipeline:status {project}",
                next_step="step-2",
            ),
            StepDefinition(
                id="step-2",
                name="User Review",
                type=StepType.user_decision,
                description="User reviews",
                decision_prompt="Approve or reject?",
                blocking=True,
                next_step="step-3",
            ),
            StepDefinition(
                id="step-3",
                name="Step Three",
                type=StepType.forge_command,
                description="Final step",
                command_template="core.pipeline:status {project}",
            ),
        ]
    return WorkflowDefinition(
        id=def_id,
        name="Test Workflow",
        description="Test workflow for e2e",
        version="1.0",
        initial_step=steps[0].id,
        steps=steps,
    )


class MockCommandExecutor(StepExecutor):
    """Mock forge_command executor that completes instantly."""

    def __init__(self):
        self.calls: list[str] = []

    async def execute(self, step_def, context, on_event=None):
        from app.workflow.models import StepResult, StepStatus
        self.calls.append(step_def.id)
        return StepResult(
            step_id=step_def.id,
            status=StepStatus.completed,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            output={"success": True, "step": step_def.id},
        )


class SlowCommandExecutor(StepExecutor):
    """Mock executor that takes a configurable delay."""

    def __init__(self, delay: float = 0.5):
        self.delay = delay

    async def execute(self, step_def, context, on_event=None):
        from app.workflow.models import StepResult, StepStatus
        await asyncio.sleep(self.delay)
        return StepResult(
            step_id=step_def.id,
            status=StepStatus.completed,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            output={"success": True},
        )


class TimeoutExecutor(StepExecutor):
    """Mock executor that sleeps forever (for timeout testing)."""

    async def execute(self, step_def, context, on_event=None):
        await asyncio.sleep(3600)  # Sleep forever — will be timed out
        return StepResult(step_id=step_def.id, status=StepStatus.completed)


# ---------------------------------------------------------------------------
# Event collector
# ---------------------------------------------------------------------------

class EventCollector:
    """Subscribes to EventBus and collects workflow events."""

    def __init__(self, event_bus: EventBus, project_slug: str):
        self.events: list[dict] = []
        self._event_bus = event_bus
        self._project_slug = project_slug
        self._task: asyncio.Task | None = None
        self._pubsub = None

    async def start(self):
        self._pubsub = await self._event_bus.subscribe(self._project_slug)
        self._task = asyncio.create_task(self._listen())

    async def _listen(self):
        while True:
            msg = await self._pubsub.get_message(
                ignore_subscribe_messages=True, timeout=0.05,
            )
            if msg and msg["type"] == "message":
                data = msg["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                try:
                    parsed = json.loads(data)
                    event_type = parsed.get("event", "")
                    if event_type in ALL_WORKFLOW_EVENT_TYPES:
                        self.events.append(parsed)
                except (json.JSONDecodeError, KeyError):
                    pass
            else:
                await asyncio.sleep(0.02)

    async def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.unsubscribe()
            if hasattr(self._pubsub, "aclose"):
                await self._pubsub.aclose()
            elif hasattr(self._pubsub, "close"):
                await self._pubsub.close()

    def events_of_type(self, event_type: str) -> list[dict]:
        return [e for e in self.events if e.get("event") == event_type]


# ---------------------------------------------------------------------------
# AC1: Engine initializes and registers presets
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_engine_initializes_with_presets(db_pool, redis_client, clean_workflows):
    """WorkflowEngine initializes and has built-in definitions."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)
    mock_cmd = MockCommandExecutor()

    step_executors = {
        StepType.forge_command: mock_cmd,
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    # Register presets
    from app.workflow.presets import BUILTIN_DEFINITIONS
    for defn in BUILTIN_DEFINITIONS.values():
        engine.register_definition(defn)

    # Verify all presets registered
    assert engine.get_definition("full-lifecycle") is not None
    assert engine.get_definition("simplified-next") is not None
    assert engine.get_definition("discovery-only") is not None


# ---------------------------------------------------------------------------
# AC2+AC3: Full multi-step workflow with pause/resume (KR-1, KR-2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_workflow_pause_and_resume(db_pool, redis_client, clean_workflows):
    """3-step workflow: command → user_decision (pause) → command (resume)."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)
    mock_cmd = MockCommandExecutor()

    step_executors = {
        StepType.forge_command: mock_cmd,
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    definition = make_test_definition()
    engine.register_definition(definition)

    # Resolve project_id
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
    project_id = row["id"]

    # Start workflow
    execution = await engine.start(
        definition=definition,
        project_slug="forge-web",
        project_id=project_id,
    )
    assert execution.status == ExecutionStatus.pending

    # Wait for it to hit the user_decision step and pause
    for _ in range(50):
        await asyncio.sleep(0.1)
        execution = await store.get_execution(execution.id)
        if execution and execution.status == ExecutionStatus.paused:
            break

    assert execution.status == ExecutionStatus.paused
    assert execution.current_step == "step-2"
    assert execution.pause_reason == "awaiting_user_decision"

    # Step 1 should be completed
    assert "step-1" in execution.step_results
    assert execution.step_results["step-1"].status == StepStatus.completed

    # Resume with user response
    resumed = await engine.resume(
        execution.id, "approve", "forge-web", project_id,
    )
    assert resumed.status == ExecutionStatus.running

    # Wait for completion
    for _ in range(50):
        await asyncio.sleep(0.1)
        execution = await store.get_execution(execution.id)
        if execution and execution.status in (
            ExecutionStatus.completed, ExecutionStatus.failed,
        ):
            break

    assert execution.status == ExecutionStatus.completed

    # All 3 steps should be completed
    assert execution.step_results["step-1"].status == StepStatus.completed
    assert execution.step_results["step-2"].status == StepStatus.completed
    assert execution.step_results["step-3"].status == StepStatus.completed

    # Mock executor was called for command steps
    assert "step-1" in mock_cmd.calls
    assert "step-3" in mock_cmd.calls


# ---------------------------------------------------------------------------
# AC4: 3 concurrent workflows (KR-3)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_workflows(db_pool, redis_client, clean_workflows):
    """3 workflows run independently without state corruption."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)

    # Use slow executor to ensure overlap
    slow_cmd = SlowCommandExecutor(delay=0.2)
    step_executors = {
        StepType.forge_command: slow_cmd,
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    # Simple 2-step workflow (no user_decision to avoid pause)
    definition = WorkflowDefinition(
        id="concurrent-test",
        name="Concurrent Test",
        description="Simple 2-step for concurrency test",
        version="1.0",
        initial_step="s1",
        steps=[
            StepDefinition(
                id="s1", name="Step 1", type=StepType.forge_command,
                description="First", command_template="core.pipeline:status {project}",
                next_step="s2",
            ),
            StepDefinition(
                id="s2", name="Step 2", type=StepType.forge_command,
                description="Second", command_template="core.pipeline:status {project}",
            ),
        ],
    )
    engine.register_definition(definition)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
    project_id = row["id"]

    # Start 3 workflows simultaneously
    executions = []
    for i in range(3):
        ex = await engine.start(
            definition=definition,
            project_slug="forge-web",
            project_id=project_id,
            variables={"index": i},
        )
        executions.append(ex)

    assert len(executions) == 3
    ext_ids = {e.ext_id for e in executions}
    assert len(ext_ids) == 3  # All unique ext_ids

    # Wait for all to complete
    for _ in range(100):
        await asyncio.sleep(0.1)
        all_done = True
        for ex in executions:
            current = await store.get_execution(ex.id)
            if current and current.status not in (
                ExecutionStatus.completed, ExecutionStatus.failed,
            ):
                all_done = False
                break
        if all_done:
            break

    # Verify all completed
    for ex in executions:
        current = await store.get_execution(ex.id)
        assert current.status == ExecutionStatus.completed, (
            f"{current.ext_id}: expected completed, got {current.status.value}"
        )
        assert "s1" in current.step_results
        assert "s2" in current.step_results

    # Verify no state corruption: each has its own variables
    for i, ex in enumerate(executions):
        current = await store.get_execution(ex.id)
        assert current.variables["index"] == i


# ---------------------------------------------------------------------------
# AC5: WebSocket events emitted for step transitions (KR-4)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_websocket_events_emitted(db_pool, redis_client, clean_workflows):
    """All step transitions emit WebSocket events."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)
    mock_cmd = MockCommandExecutor()

    step_executors = {
        StepType.forge_command: mock_cmd,
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    # Simple 2-step workflow (no pause to get clean event sequence)
    definition = WorkflowDefinition(
        id="events-test",
        name="Events Test",
        description="Test event emission",
        version="1.0",
        initial_step="a",
        steps=[
            StepDefinition(
                id="a", name="A", type=StepType.forge_command,
                description="Step A", command_template="core.pipeline:status {project}",
                next_step="b",
            ),
            StepDefinition(
                id="b", name="B", type=StepType.forge_command,
                description="Step B", command_template="core.pipeline:status {project}",
            ),
        ],
    )
    engine.register_definition(definition)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
    project_id = row["id"]

    # Collect events
    collector = EventCollector(event_bus, "forge-web")
    await collector.start()
    await asyncio.sleep(0.1)  # Let subscriber initialize

    # Start workflow
    execution = await engine.start(
        definition=definition,
        project_slug="forge-web",
        project_id=project_id,
    )

    # Wait for completion
    for _ in range(50):
        await asyncio.sleep(0.1)
        current = await store.get_execution(execution.id)
        if current and current.status in (
            ExecutionStatus.completed, ExecutionStatus.failed,
        ):
            break

    await asyncio.sleep(0.3)  # Give events time to propagate
    await collector.stop()

    # Verify event types emitted
    event_types = [e["event"] for e in collector.events]

    assert WorkflowEventType.STARTED in event_types
    assert WorkflowEventType.STEP_STARTED in event_types
    assert WorkflowEventType.STEP_COMPLETED in event_types
    assert WorkflowEventType.COMPLETED in event_types

    # Verify event payloads have correct execution_id
    for e in collector.events:
        payload = e.get("payload", {})
        assert payload.get("execution_id") == execution.ext_id


# ---------------------------------------------------------------------------
# AC6: Step timeout triggers graceful failure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_step_timeout_graceful_failure(db_pool, redis_client, clean_workflows):
    """Workflow with tight timeout fails gracefully."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)

    # Use timeout executor with extremely short workflow timeout
    step_executors = {
        StepType.forge_command: TimeoutExecutor(),
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(
        store=store,
        event_bus=event_bus,
        step_executors=step_executors,
        workflow_timeout=2,  # 2-second workflow timeout
    )

    definition = WorkflowDefinition(
        id="timeout-test",
        name="Timeout Test",
        description="Test timeout",
        version="1.0",
        initial_step="slow",
        steps=[
            StepDefinition(
                id="slow", name="Slow", type=StepType.forge_command,
                description="Will timeout", command_template="core.pipeline:status {project}",
            ),
        ],
    )
    engine.register_definition(definition)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
    project_id = row["id"]

    execution = await engine.start(
        definition=definition,
        project_slug="forge-web",
        project_id=project_id,
    )

    # Wait for timeout (2s workflow timeout)
    for _ in range(50):
        await asyncio.sleep(0.2)
        current = await store.get_execution(execution.id)
        if current and current.status == ExecutionStatus.failed:
            break

    current = await store.get_execution(execution.id)
    assert current.status == ExecutionStatus.failed
    assert "timed out" in (current.error or "").lower()


# ---------------------------------------------------------------------------
# AC7: Recovery marks stale executions as failed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recovery_marks_stale_as_failed(db_pool, redis_client, clean_workflows):
    """Engine recovery marks running executions as failed on startup."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)

    # Create a "stale" execution by inserting directly into DB
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
        project_id = row["id"]

        # Insert stale execution as "running"
        await conn.execute("""
            INSERT INTO workflow_executions
                (ext_id, project_id, workflow_def_id, status, variables, created_at, updated_at)
            VALUES
                ('WE-STALE-1', $1, 'test-workflow', 'running', '{}', NOW(), NOW()),
                ('WE-STALE-2', $1, 'test-workflow', 'paused', '{}', NOW(), NOW())
        """, project_id)

    # Create new engine and recover
    step_executors = {
        StepType.forge_command: MockCommandExecutor(),
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    recovered = await engine.recover()
    assert recovered == 2

    # Verify both marked as failed
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT ext_id, status, error FROM workflow_executions
            WHERE ext_id IN ('WE-STALE-1', 'WE-STALE-2')
        """)

    for row in rows:
        assert row["status"] == "failed"
        assert "restart" in row["error"].lower()


# ---------------------------------------------------------------------------
# Cancel test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancel_running_workflow(db_pool, redis_client, clean_workflows):
    """Cancel a running workflow stops execution."""
    event_bus = EventBus(redis_client)
    store = WorkflowStore(db_pool)

    # Use slow executor so we can cancel mid-flight
    slow_cmd = SlowCommandExecutor(delay=2.0)
    step_executors = {
        StepType.forge_command: slow_cmd,
        StepType.user_decision: UserDecisionStepExecutor(event_bus),
    }
    engine = WorkflowEngine(store=store, event_bus=event_bus, step_executors=step_executors)

    definition = WorkflowDefinition(
        id="cancel-test",
        name="Cancel Test",
        description="Test cancellation",
        version="1.0",
        initial_step="slow-step",
        steps=[
            StepDefinition(
                id="slow-step", name="Slow", type=StepType.forge_command,
                description="Slow step", command_template="core.pipeline:status {project}",
            ),
        ],
    )
    engine.register_definition(definition)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM projects WHERE slug = 'forge-web'")
    project_id = row["id"]

    # Start
    execution = await engine.start(
        definition=definition,
        project_slug="forge-web",
        project_id=project_id,
    )

    # Wait for running
    for _ in range(20):
        await asyncio.sleep(0.1)
        current = await store.get_execution(execution.id)
        if current and current.status == ExecutionStatus.running:
            break

    # Cancel
    cancelled = await engine.cancel(execution.id, "forge-web")
    assert cancelled.status == ExecutionStatus.cancelled

    # Verify in DB
    final = await store.get_execution(execution.id)
    assert final.status == ExecutionStatus.cancelled

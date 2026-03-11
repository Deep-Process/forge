"""Execution router — start task execution, stream output, track progress."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.dependencies import get_storage
from app.routers._helpers import (
    _get_lock,
    check_project_exists,
    emit_event,
    find_item_or_404,
    load_entity,
    save_entity,
)

router = APIRouter(prefix="/projects/{slug}/execute", tags=["execution"])

# ---------------------------------------------------------------------------
# In-memory execution store (per-process; not persisted across restarts)
# ---------------------------------------------------------------------------

_executions: dict[str, dict[str, Any]] = {}  # execution_id -> ExecutionRecord
_execution_tasks: dict[str, asyncio.Task] = {}  # execution_id -> background task


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ExecutionStart(BaseModel):
    """Body for starting a task execution."""
    mode: str = "mock"  # "mock" or "llm" (llm reserved for future)
    context_override: dict[str, Any] | None = None


class ExecutionState(BaseModel):
    """Serialisable snapshot of an execution."""
    execution_id: str
    task_id: str
    project: str
    status: str  # pending, running, completed, failed, cancelled
    started_at: str
    completed_at: str | None = None
    output_chunks: list[str] = []
    token_usage: dict[str, int] = {"input_tokens": 0, "output_tokens": 0}
    error: str | None = None


# ---------------------------------------------------------------------------
# Mock streaming chunks — simulates realistic LLM task execution output
# ---------------------------------------------------------------------------

_MOCK_CHUNKS = [
    "Analyzing task requirements...\n",
    "Reading project context and dependency outputs...\n",
    "\n--- Planning Phase ---\n",
    "1. Identify affected files and modules\n",
    "2. Determine implementation approach\n",
    "3. Write code changes\n",
    "4. Validate against acceptance criteria\n",
    "\n--- Implementation ---\n",
    "Scanning project structure... found 12 relevant files.\n",
    "Applying changes to `src/components/TaskView.tsx`:\n",
    "```diff\n",
    "- import { Task } from '../types';\n",
    "+ import { Task, ExecutionStatus } from '../types';\n",
    "```\n",
    "\n",
    "Adding execution status indicator component...\n",
    "Writing helper function `formatExecutionOutput()`...\n",
    "Updating unit tests in `__tests__/TaskView.test.tsx`...\n",
    "\n--- Validation ---\n",
    "Running linter... passed.\n",
    "Running type checker... passed.\n",
    "Running unit tests... 14/14 passed.\n",
    "\n--- Summary ---\n",
    "Modified 3 files, added 47 lines, removed 5 lines.\n",
    "All acceptance criteria satisfied.\n",
    "Task implementation complete.\n",
]


def _estimate_mock_tokens(chunks: list[str]) -> dict[str, int]:
    """Estimate token usage for mock output."""
    total_text = "".join(chunks)
    output_tokens = max(1, len(total_text) // 4)
    # Simulate a context window with input tokens
    input_tokens = 2400  # Approximate context size
    return {"input_tokens": input_tokens, "output_tokens": output_tokens}


# ---------------------------------------------------------------------------
# Background execution runner
# ---------------------------------------------------------------------------

async def _run_mock_execution(
    execution_id: str,
    slug: str,
    task_id: str,
    request_app: Any,
) -> None:
    """Simulate LLM streaming execution in background.

    Yields mock chunks with realistic timing, emits events via EventBus,
    and updates the in-memory execution record.
    """
    record = _executions.get(execution_id)
    if record is None:
        return

    # Transition to running
    record["status"] = "running"
    record["started_at"] = datetime.now(timezone.utc).isoformat()

    # Emit running event
    event_bus = getattr(request_app.state, "event_bus", None)
    if event_bus:
        try:
            await event_bus.emit(slug, "execution.output", {
                "execution_id": execution_id,
                "task_id": task_id,
                "type": "status",
                "status": "running",
            })
        except Exception:
            pass

    try:
        for i, chunk in enumerate(_MOCK_CHUNKS):
            # Check for cancellation
            if record["status"] == "cancelled":
                return

            record["output_chunks"].append(chunk)

            # Emit chunk event via EventBus
            if event_bus:
                try:
                    await event_bus.emit(slug, "execution.output", {
                        "execution_id": execution_id,
                        "task_id": task_id,
                        "type": "chunk",
                        "index": i,
                        "content": chunk,
                    })
                except Exception:
                    pass

            # Simulate LLM latency (50-200ms per chunk)
            await asyncio.sleep(0.08)

        # Completed successfully
        record["status"] = "completed"
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        record["token_usage"] = _estimate_mock_tokens(record["output_chunks"])

        if event_bus:
            try:
                await event_bus.emit(slug, "execution.output", {
                    "execution_id": execution_id,
                    "task_id": task_id,
                    "type": "status",
                    "status": "completed",
                    "token_usage": record["token_usage"],
                })
            except Exception:
                pass

    except asyncio.CancelledError:
        record["status"] = "cancelled"
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        if event_bus:
            try:
                await event_bus.emit(slug, "execution.output", {
                    "execution_id": execution_id,
                    "task_id": task_id,
                    "type": "status",
                    "status": "cancelled",
                })
            except Exception:
                pass
    except Exception as exc:
        record["status"] = "failed"
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        record["error"] = str(exc)

        if event_bus:
            try:
                await event_bus.emit(slug, "execution.output", {
                    "execution_id": execution_id,
                    "task_id": task_id,
                    "type": "status",
                    "status": "failed",
                    "error": str(exc),
                })
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Helper: persist execution record to project storage
# ---------------------------------------------------------------------------

async def _persist_execution(storage, slug: str, record: dict) -> None:
    """Append or update execution record in the project's executions entity."""
    async with _get_lock(slug, "executions"):
        data = await load_entity(storage, slug, "executions")
        executions = data.get("executions", [])

        # Update existing or append
        found = False
        for i, ex in enumerate(executions):
            if ex.get("execution_id") == record["execution_id"]:
                executions[i] = record.copy()
                found = True
                break
        if not found:
            executions.append(record.copy())

        data["executions"] = executions
        await save_entity(storage, slug, "executions", data)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{task_id}", status_code=201)
async def start_execution(
    request: Request,
    slug: str,
    task_id: str,
    body: ExecutionStart | None = None,
    storage=Depends(get_storage),
):
    """Start task execution.

    Creates an execution record, validates the task exists and is in a
    runnable state, then launches a background mock-streaming coroutine.
    Returns the execution_id immediately.
    """
    await check_project_exists(storage, slug)

    # Validate task exists
    tracker = await load_entity(storage, slug, "tracker")
    task = find_item_or_404(tracker.get("tasks", []), task_id, "Task")

    # Only allow execution of tasks that are IN_PROGRESS
    task_status = task.get("status", "")
    if task_status not in ("IN_PROGRESS", "CLAIMING"):
        raise HTTPException(
            422,
            f"Task must be IN_PROGRESS or CLAIMING to execute, currently '{task_status}'",
        )

    # Check for already-running execution on this task
    for ex in _executions.values():
        if (
            ex.get("task_id") == task_id
            and ex.get("project") == slug
            and ex.get("status") in ("pending", "running")
        ):
            raise HTTPException(
                409,
                f"Task '{task_id}' already has an active execution: {ex['execution_id']}",
            )

    # Create execution record
    execution_id = f"EX-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    record: dict[str, Any] = {
        "execution_id": execution_id,
        "task_id": task_id,
        "project": slug,
        "status": "pending",
        "started_at": now,
        "completed_at": None,
        "output_chunks": [],
        "token_usage": {"input_tokens": 0, "output_tokens": 0},
        "error": None,
    }
    _executions[execution_id] = record

    # Persist initial record
    await _persist_execution(storage, slug, record)

    # Launch background execution
    bg_task = asyncio.create_task(
        _run_mock_execution(execution_id, slug, task_id, request.app)
    )
    _execution_tasks[execution_id] = bg_task

    # When background task finishes, persist final state
    def _on_done(fut: asyncio.Task) -> None:
        async def _persist_final():
            try:
                await _persist_execution(storage, slug, _executions.get(execution_id, record))
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Failed to persist execution %s: %s", execution_id, exc)
            finally:
                _execution_tasks.pop(execution_id, None)
        asyncio.ensure_future(_persist_final())

    bg_task.add_done_callback(_on_done)

    await emit_event(request, slug, "task.progress", {
        "task_id": task_id,
        "execution_id": execution_id,
        "status": "pending",
    })

    return {
        "execution_id": execution_id,
        "task_id": task_id,
        "status": "pending",
    }


@router.get("/{task_id}/status")
async def execution_status(
    slug: str,
    task_id: str,
    storage=Depends(get_storage),
):
    """Get the current execution status for a task.

    Returns the most recent execution for the given task, checking both
    in-memory records and persisted storage.
    """
    await check_project_exists(storage, slug)

    # Check in-memory first (active executions)
    active = [
        ex for ex in _executions.values()
        if ex.get("task_id") == task_id and ex.get("project") == slug
    ]

    if active:
        # Return the most recent one
        active.sort(key=lambda x: x.get("started_at", ""), reverse=True)
        record = active[0]
        return ExecutionState(**{
            "execution_id": record["execution_id"],
            "task_id": record["task_id"],
            "project": record["project"],
            "status": record["status"],
            "started_at": record["started_at"],
            "completed_at": record.get("completed_at"),
            "output_chunks": record.get("output_chunks", []),
            "token_usage": record.get("token_usage", {}),
            "error": record.get("error"),
        })

    # Fall back to persisted storage
    try:
        data = await load_entity(storage, slug, "executions")
        executions = data.get("executions", [])
        task_execs = [ex for ex in executions if ex.get("task_id") == task_id]
        if task_execs:
            task_execs.sort(key=lambda x: x.get("started_at", ""), reverse=True)
            record = task_execs[0]
            return ExecutionState(**{
                "execution_id": record["execution_id"],
                "task_id": record["task_id"],
                "project": record.get("project", slug),
                "status": record["status"],
                "started_at": record["started_at"],
                "completed_at": record.get("completed_at"),
                "output_chunks": record.get("output_chunks", []),
                "token_usage": record.get("token_usage", {}),
                "error": record.get("error"),
            })
    except Exception:
        pass

    raise HTTPException(404, f"No execution found for task '{task_id}'")


@router.get("/{task_id}/history")
async def execution_history(
    slug: str,
    task_id: str,
    storage=Depends(get_storage),
):
    """List all execution records for a task (newest first)."""
    await check_project_exists(storage, slug)

    results: list[dict] = []

    # In-memory records
    for ex in _executions.values():
        if ex.get("task_id") == task_id and ex.get("project") == slug:
            results.append(ex.copy())

    # Persisted records (avoid duplicates)
    try:
        data = await load_entity(storage, slug, "executions")
        executions = data.get("executions", [])
        in_mem_ids = {r["execution_id"] for r in results}
        for ex in executions:
            if ex.get("task_id") == task_id and ex["execution_id"] not in in_mem_ids:
                results.append(ex.copy())
    except Exception:
        pass

    results.sort(key=lambda x: x.get("started_at", ""), reverse=True)

    return {"executions": results, "count": len(results)}


@router.post("/{task_id}/cancel")
async def cancel_execution(
    request: Request,
    slug: str,
    task_id: str,
    storage=Depends(get_storage),
):
    """Cancel a running execution for a task.

    Sets the execution status to 'cancelled' and cancels the background
    asyncio task if it is still running.
    """
    await check_project_exists(storage, slug)

    # Find active execution for this task
    active = [
        ex for ex in _executions.values()
        if ex.get("task_id") == task_id
        and ex.get("project") == slug
        and ex.get("status") in ("pending", "running")
    ]

    if not active:
        raise HTTPException(404, f"No active execution found for task '{task_id}'")

    record = active[0]
    execution_id = record["execution_id"]

    # Mark as cancelled
    record["status"] = "cancelled"
    record["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Cancel the background asyncio task
    bg_task = _execution_tasks.pop(execution_id, None)
    if bg_task and not bg_task.done():
        bg_task.cancel()

    # Persist cancellation
    await _persist_execution(storage, slug, record)

    await emit_event(request, slug, "execution.output", {
        "execution_id": execution_id,
        "task_id": task_id,
        "type": "status",
        "status": "cancelled",
    })

    return {
        "execution_id": execution_id,
        "task_id": task_id,
        "status": "cancelled",
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint for streaming execution output
# ---------------------------------------------------------------------------

@router.websocket("/{task_id}/stream")
async def execution_stream(websocket: WebSocket, slug: str, task_id: str):
    """WebSocket endpoint for real-time execution output streaming.

    Clients connect here to receive chunks as they are produced by the
    mock (or future LLM) execution engine. Messages are JSON:

        {"type": "chunk", "index": 0, "content": "..."}
        {"type": "status", "status": "completed", "token_usage": {...}}
    """
    # Auth check (follows ws.py pattern)
    from app.auth import _is_auth_configured, decode_access_token
    if _is_auth_configured():
        from app.config import settings
        import hmac

        token = websocket.query_params.get("token")
        api_key = websocket.headers.get("x-api-key")

        authenticated = False
        if api_key and settings.api_key and hmac.compare_digest(api_key, settings.api_key):
            authenticated = True
        elif token:
            from jose import JWTError
            try:
                decode_access_token(token)
                authenticated = True
            except JWTError:
                pass

        if not authenticated:
            await websocket.close(code=4001, reason="Unauthorized")
            return

    # Validate project exists
    storage = websocket.app.state.storage
    if storage is not None:
        exists = storage.exists(slug, "tracker")
        if not exists:
            await websocket.close(code=4004, reason="Project not found")
            return

    await websocket.accept()

    # Subscribe to execution.output events for this project, filter by task_id
    event_bus = getattr(websocket.app.state, "event_bus", None)
    if event_bus is None:
        await websocket.close(code=1011, reason="Event bus unavailable")
        return
    pubsub = None
    try:
        import json
        pubsub = await event_bus.subscribe(slug)

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message and message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    # Only forward execution.output events for this task
                    if (
                        data.get("event") == "execution.output"
                        and data.get("payload", {}).get("task_id") == task_id
                    ):
                        await websocket.send_json(data["payload"])

                        # Close on terminal status
                        terminal = data["payload"].get("status")
                        if terminal in ("completed", "failed", "cancelled"):
                            await websocket.close(code=1000, reason=f"Execution {terminal}")
                            return
                except (json.JSONDecodeError, KeyError) as e:
                    import logging
                    logging.getLogger(__name__).debug("Malformed event payload: %s", e)
            else:
                await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Execution stream error: %s", e, exc_info=True)
    finally:
        if pubsub is not None:
            await pubsub.unsubscribe()
            await pubsub.aclose()

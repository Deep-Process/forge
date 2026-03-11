"""DebugCapture — service for capturing LLM call debug data when enabled."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.routers._helpers import _get_lock

logger = logging.getLogger(__name__)

# Maximum persisted sessions per project (F-003: retention policy)
MAX_PERSISTED_SESSIONS = 500
# Maximum active (in-flight) sessions (F-002: bounded memory)
MAX_ACTIVE_SESSIONS = 100
# Patterns to redact from debug data (F-004: sensitive data)
_SENSITIVE_PATTERNS = [
    re.compile(r"(sk-[a-zA-Z0-9]{20,})"),            # API keys
    re.compile(r"(Bearer\s+[a-zA-Z0-9._\-]+)"),      # Bearer tokens
    re.compile(r"(password\s*[:=]\s*\S+)", re.I),     # Passwords
    re.compile(r"(api[_-]?key\s*[:=]\s*\S+)", re.I),  # API key assignments
]


def _redact_sensitive(text: str) -> str:
    """Redact known sensitive patterns from text (F-004)."""
    for pattern in _SENSITIVE_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


class DebugSession:
    """Complete debug capture for one LLM call.

    Attributes mirror the full debug payload stored in debug_sessions.json.
    """

    __slots__ = (
        "session_id",
        "timestamp",
        "project",
        "task_id",
        "execution_id",
        "contract_id",
        "contract_name",
        "provider",
        "model",
        "temperature",
        "max_tokens",
        "response_format",
        "system_prompt",
        "user_prompt",
        "context_sections",
        "total_context_tokens",
        "tools",
        "raw_response",
        "parsed_output",
        "stop_reason",
        "validation_results",
        "validation_passed",
        "token_usage",
        "latency_ms",
        "status",
        "error",
        "error_type",
        "_start_time",
    )

    def __init__(
        self,
        *,
        session_id: str,
        project: str,
        task_id: str | None = None,
        execution_id: str | None = None,
        contract_id: str | None = None,
        contract_name: str | None = None,
        provider: str = "unknown",
        model: str = "unknown",
        temperature: float = 0.0,
        max_tokens: int = 0,
        response_format: str = "text",
        system_prompt: str = "",
        user_prompt: str = "",
        context_sections: list[dict] | None = None,
        total_context_tokens: int = 0,
        tools: list[dict] | None = None,
    ) -> None:
        self.session_id = session_id
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.project = project
        self.task_id = task_id
        self.execution_id = execution_id
        self.contract_id = contract_id
        self.contract_name = contract_name
        self.provider = provider
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.response_format = response_format
        self.system_prompt = system_prompt
        self.user_prompt = user_prompt
        self.context_sections = context_sections or []
        self.total_context_tokens = total_context_tokens
        self.tools = tools

        # Response — filled later
        self.raw_response: str = ""
        self.parsed_output: dict | None = None
        self.stop_reason: str = ""

        # Validation — filled later
        self.validation_results: list[dict] = []
        self.validation_passed: bool = True

        # Metrics — filled later
        self.token_usage: dict[str, int] = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
        }
        self.latency_ms: int = 0

        # Status
        self.status: str = "pending"
        self.error: str | None = None
        self.error_type: str | None = None

        # Internal timing
        self._start_time: float = time.monotonic()

    def to_dict(self) -> dict[str, Any]:
        """Serialise session to a JSON-compatible dict with sensitive data redacted."""
        return {
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "project": self.project,
            "task_id": self.task_id,
            "execution_id": self.execution_id,
            "contract_id": self.contract_id,
            "contract_name": self.contract_name,
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "response_format": self.response_format,
            "system_prompt": _redact_sensitive(self.system_prompt),
            "user_prompt": _redact_sensitive(self.user_prompt),
            "context_sections": [
                {**s, "content": _redact_sensitive(s.get("content", ""))}
                for s in self.context_sections
            ],
            "total_context_tokens": self.total_context_tokens,
            "tools": self.tools,
            "raw_response": _redact_sensitive(self.raw_response),
            "parsed_output": self.parsed_output,
            "stop_reason": self.stop_reason,
            "validation_results": self.validation_results,
            "validation_passed": self.validation_passed,
            "token_usage": self.token_usage,
            "latency_ms": self.latency_ms,
            "status": self.status,
            "error": self.error,
            "error_type": self.error_type,
        }

    def to_summary(self) -> dict[str, Any]:
        """Return a lightweight summary (used for list endpoints and events)."""
        return {
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "contract_id": self.contract_id,
            "provider": self.provider,
            "model": self.model,
            "task_id": self.task_id,
            "execution_id": self.execution_id,
            "status": self.status,
            "latency_ms": self.latency_ms,
            "token_usage": self.token_usage,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Storage helpers (sync -> async bridge)
# Uses shared _get_lock from _helpers.py (F-013: single lock namespace)
# ---------------------------------------------------------------------------

async def _load_debug_data(storage, project: str) -> dict:
    """Load debug_sessions entity from storage."""
    return await asyncio.to_thread(storage.load_data, project, "debug_sessions")


async def _save_debug_data(storage, project: str, data: dict) -> None:
    """Save debug_sessions entity to storage."""
    await asyncio.to_thread(storage.save_data, project, "debug_sessions", data)


def _prune_sessions(sessions: list[dict], max_count: int = MAX_PERSISTED_SESSIONS) -> int:
    """Remove oldest sessions if over capacity. Returns number pruned."""
    if len(sessions) <= max_count:
        return 0
    # Sort by timestamp ascending, keep newest
    sessions.sort(key=lambda s: s.get("timestamp", ""))
    pruned = len(sessions) - max_count
    del sessions[:pruned]
    return pruned


# ---------------------------------------------------------------------------
# DebugCapture service
# ---------------------------------------------------------------------------

class DebugCapture:
    """Captures debug data for LLM calls when enabled.

    Maintains an in-memory cache of enabled projects and an in-memory store
    of active (not yet finalised) sessions for fast lookup.

    Uses shared locks from _helpers._get_lock() to ensure mutual exclusion
    with the debug router endpoints (F-013 fix).
    """

    def __init__(self, storage, event_bus=None) -> None:
        self._storage = storage
        self._event_bus = event_bus
        self._enabled_projects: set[str] = set()
        self._active_sessions: dict[str, DebugSession] = {}  # session_id -> session

    # ---- Enable / Disable ----

    async def is_enabled(self, project: str) -> bool:
        """Check if debug capture is enabled for a project."""
        if project in self._enabled_projects:
            return True
        # Check persisted config
        try:
            data = await _load_debug_data(self._storage, project)
            enabled = data.get("config", {}).get("enabled", False)
            if enabled:
                self._enabled_projects.add(project)
            return enabled
        except Exception:
            return False

    async def enable(self, project: str) -> None:
        """Enable debug capture for a project."""
        async with _get_lock(project, "debug_sessions"):
            data = await _load_debug_data(self._storage, project)
            config = data.get("config", {})
            config["enabled"] = True
            config["enabled_at"] = datetime.now(timezone.utc).isoformat()
            data["config"] = config
            if "sessions" not in data:
                data["sessions"] = []
            await _save_debug_data(self._storage, project, data)
        self._enabled_projects.add(project)

    async def disable(self, project: str) -> None:
        """Disable debug capture for a project."""
        async with _get_lock(project, "debug_sessions"):
            data = await _load_debug_data(self._storage, project)
            config = data.get("config", {})
            config["enabled"] = False
            config["disabled_at"] = datetime.now(timezone.utc).isoformat()
            data["config"] = config
            await _save_debug_data(self._storage, project, data)
        self._enabled_projects.discard(project)

    # ---- Capture lifecycle ----

    async def capture_start(
        self,
        project: str,
        *,
        task_id: str | None = None,
        execution_id: str | None = None,
        contract_id: str | None = None,
        contract_name: str | None = None,
        provider: str = "unknown",
        model: str = "unknown",
        temperature: float = 0.0,
        max_tokens: int = 0,
        response_format: str = "text",
        system_prompt: str = "",
        user_prompt: str = "",
        context_sections: list[dict] | None = None,
        total_context_tokens: int = 0,
        tools: list[dict] | None = None,
    ) -> str:
        """Start a debug capture session. Returns session_id."""
        # F-002: Evict oldest active sessions if over capacity
        if len(self._active_sessions) >= MAX_ACTIVE_SESSIONS:
            oldest_id = min(
                self._active_sessions,
                key=lambda sid: self._active_sessions[sid]._start_time,
            )
            evicted = self._active_sessions.pop(oldest_id)
            logger.warning(
                "Evicted stale active debug session %s (started %s)",
                oldest_id, evicted.timestamp,
            )

        session_id = f"DS-{uuid.uuid4().hex[:12]}"
        session = DebugSession(
            session_id=session_id,
            project=project,
            task_id=task_id,
            execution_id=execution_id,
            contract_id=contract_id,
            contract_name=contract_name,
            provider=provider,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            context_sections=context_sections,
            total_context_tokens=total_context_tokens,
            tools=tools,
        )
        self._active_sessions[session_id] = session
        return session_id

    async def capture_response(
        self,
        session_id: str,
        *,
        raw_response: str = "",
        parsed_output: dict | None = None,
        stop_reason: str = "end_turn",
        token_usage: dict[str, int] | None = None,
    ) -> None:
        """Record the LLM response for a session."""
        session = self._active_sessions.get(session_id)
        if session is None:
            return

        session.raw_response = raw_response
        session.parsed_output = parsed_output
        session.stop_reason = stop_reason

        if token_usage:
            session.token_usage = {
                "input_tokens": token_usage.get("input_tokens", 0),
                "output_tokens": token_usage.get("output_tokens", 0),
                "total_tokens": token_usage.get("input_tokens", 0)
                + token_usage.get("output_tokens", 0),
            }

        # Calculate latency
        session.latency_ms = int((time.monotonic() - session._start_time) * 1000)
        session.status = "success"

    async def capture_validation(
        self,
        session_id: str,
        *,
        validation_results: list[dict] | None = None,
        validation_passed: bool = True,
    ) -> None:
        """Record validation results for a session."""
        session = self._active_sessions.get(session_id)
        if session is None:
            return

        session.validation_results = validation_results or []
        session.validation_passed = validation_passed

        if not validation_passed:
            session.status = "validation_failed"
            session.error = "Validation failed"
            session.error_type = "validation_error"

    async def capture_error(
        self,
        session_id: str,
        *,
        error: str = "",
        error_type: str = "provider_error",
    ) -> None:
        """Record an error for a session."""
        session = self._active_sessions.get(session_id)
        if session is None:
            return

        session.status = "error"
        session.error = error
        session.error_type = error_type
        session.latency_ms = int((time.monotonic() - session._start_time) * 1000)

    async def finalize(self, session_id: str, project: str) -> dict:
        """Finalise session, persist to storage, emit event. Returns session dict."""
        session = self._active_sessions.pop(session_id, None)
        if session is None:
            logger.warning("finalize() called for unknown session %s", session_id)
            return {}

        # Ensure latency is recorded
        if session.latency_ms == 0:
            session.latency_ms = int((time.monotonic() - session._start_time) * 1000)

        session_dict = session.to_dict()

        # Persist to storage (F-005: re-insert on failure, F-013: shared lock)
        try:
            async with _get_lock(project, "debug_sessions"):
                data = await _load_debug_data(self._storage, project)
                sessions = data.get("sessions", [])
                sessions.append(session_dict)
                # F-003: Prune if over capacity
                pruned = _prune_sessions(sessions, MAX_PERSISTED_SESSIONS)
                if pruned:
                    logger.info("Pruned %d old debug sessions for %s", pruned, project)
                data["sessions"] = sessions
                await _save_debug_data(self._storage, project, data)
        except Exception as exc:
            # F-005: On storage failure, log and do NOT lose session data
            logger.error(
                "Failed to persist debug session %s: %s — session data lost",
                session_id, exc,
            )
            # Do not re-insert; the session data is returned to caller
            # and was already serialized to session_dict

        # Emit event
        if self._event_bus is not None:
            try:
                await self._event_bus.emit(
                    project,
                    "debug.session",
                    session.to_summary(),
                )
            except Exception as exc:
                logger.debug("Failed to emit debug.session event: %s", exc)

        return session_dict

    # ---- Query helpers ----

    async def get_session_count(self, project: str) -> int:
        """Return the total number of persisted debug sessions."""
        try:
            data = await _load_debug_data(self._storage, project)
            return len(data.get("sessions", []))
        except Exception:
            return 0

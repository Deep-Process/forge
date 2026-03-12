"""LLM Chat router — chat endpoint, provider management, config, sessions."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.dependencies import (
    get_llm_config,
    get_provider_registry,
    get_session_manager,
    get_storage,
    get_tool_registry,
    get_event_bus,
)
from app.models.llm_config import LLMConfigUpdate

router = APIRouter(prefix="/llm", tags=["llm"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ProviderTestRequest(BaseModel):
    provider: str = "anthropic"


class ProviderTestResponse(BaseModel):
    provider: str
    status: str  # "ok" | "error"
    model: str | None = None
    latency_ms: int | None = None
    message: str | None = None
    error: str | None = None


class ProviderInfo(BaseModel):
    name: str
    provider_type: str
    default_model: str
    status: str = "unchecked"


# Scope (frontend plural) → context_type (backend singular) mapping
SCOPE_TO_CONTEXT_TYPE: dict[str, str] = {
    "skills": "skill",
    "tasks": "task",
    "objectives": "objective",
    "ideas": "idea",
    "decisions": "decision",
    "knowledge": "knowledge",
    "guidelines": "guideline",
    "lessons": "lesson",
    "projects": "project",
    "ac_templates": "ac_template",
    "changes": "change",
    "dashboard": "global",
    "settings": "global",
}


class ChatRequest(BaseModel):
    """Request body for POST /llm/chat."""

    message: str = Field(..., min_length=1, max_length=10_000)
    context_type: str = Field(default="global", description="Entity context type")
    context_id: str = Field(default="", description="Entity ID (e.g., SK-001)")
    project: str = Field(default="", description="Project slug")
    session_id: str | None = Field(default=None, description="Resume existing session")
    model: str | None = Field(default=None, description="Override model")
    scopes: list[str] | None = Field(default=None, description="Frontend scopes (mapped to context_types)")
    disabled_capabilities: list[str] | None = Field(default=None, description="Tool names to disable")


class ChatResponse(BaseModel):
    """Response from POST /llm/chat."""

    session_id: str
    content: str
    model: str = ""
    iterations: int = 0
    tool_calls: list[dict[str, Any]] = []
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    stop_reason: str = ""


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    request: Request,
    body: ChatRequest,
    config=Depends(get_llm_config),
    registry=Depends(get_provider_registry),
    tool_registry=Depends(get_tool_registry),
    session_manager=Depends(get_session_manager),
    storage=Depends(get_storage),
    event_bus=Depends(get_event_bus),
) -> ChatResponse:
    """Send a message to LLM and get a response with tool-use support.

    Orchestrates: session → context → permissions → agent loop → save.
    Emits WS events for real-time streaming.
    """
    from core.llm.provider import CompletionConfig, Message, ProviderError
    from app.llm.agent_loop import AgentLoop, StreamEvent
    from app.llm.context_resolver import ContextResolver
    from app.llm.permissions import PermissionEngine

    # --- Check feature flag ---
    _CONTEXT_FLAG_MAP = {
        "skill": "skills", "task": "tasks", "objective": "objectives",
        "idea": "ideas", "knowledge": "knowledge", "guideline": "guidelines",
        "decision": "decisions", "lesson": "lessons", "project": "projects",
        "ac_template": "ac_templates",
    }
    if body.context_type != "global":
        flag_name = _CONTEXT_FLAG_MAP.get(body.context_type)
        if flag_name:
            flags = config.feature_flags
            if hasattr(flags, flag_name) and not getattr(flags, flag_name, False):
                raise HTTPException(
                    status_code=403,
                    detail=f"LLM chat is disabled for module '{body.context_type}'. "
                           f"Enable it in Settings > LLM > Feature Flags.",
                )

    # --- Resolve provider ---
    provider_name = config.default_provider
    try:
        provider = registry.get(provider_name)
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=f"LLM provider not available: {e}")

    caps = provider.capabilities()
    model = body.model or config.default_model or caps.model_id

    # --- Load or create session ---
    from app.llm.session_manager import ChatMessage

    session = None
    if body.session_id:
        session = await session_manager.load(body.session_id)
        if session is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session '{body.session_id}' not found or expired",
            )

    if session is None:
        session = await session_manager.create(
            context_type=body.context_type,
            context_id=body.context_id,
            project=body.project,
            model=model,
        )

    # --- Add user message to session and build conversation ---
    session.messages.append(ChatMessage(role="user", content=body.message))
    await session_manager.save(session)

    messages: list[Message] = [
        Message(role=msg.role, content=msg.content)
        for msg in session.messages
    ]

    # --- Resolve context for system prompt ---
    resolver = ContextResolver(storage)
    context_payload = await resolver.resolve(
        context_type=body.context_type,
        context_id=body.context_id,
        project=body.project,
    )
    system_prompt = context_payload.to_system_prompt()

    # --- Build permissions ---
    permissions = PermissionEngine.load_permissions(config)

    # --- Build completion config ---
    completion_config = CompletionConfig(
        model=model,
        temperature=0.3,
        max_tokens=caps.max_output_tokens,
        system_prompt=system_prompt,
    )

    # --- Event callback (emit WS events) ---
    async def on_event(event: StreamEvent) -> None:
        if event_bus is None:
            return
        slug = body.project or "_global"
        event_type_map = {
            "token": "chat.token",
            "thinking": "chat.token",
            "tool_call": "chat.tool_call",
            "tool_result": "chat.tool_result",
            "complete": "chat.complete",
            "error": "chat.error",
        }
        ws_event = event_type_map.get(event.type)
        if ws_event:
            try:
                await event_bus.emit(slug, ws_event, {
                    "session_id": session.session_id,
                    **event.data,
                })
            except Exception:
                logger.debug("Failed to emit WS event %s for session %s",
                             ws_event, session.session_id, exc_info=True)

    # --- Resolve context_types from scopes (if provided) ---
    context_types: str | list[str] = body.context_type
    if body.scopes:
        mapped = []
        for scope in body.scopes:
            ct = SCOPE_TO_CONTEXT_TYPE.get(scope, scope)
            if ct not in mapped:
                mapped.append(ct)
        context_types = mapped if mapped else body.context_type

    # --- Run agent loop ---
    loop = AgentLoop(
        provider=provider,
        tool_registry=tool_registry,
        storage=storage,
        permissions=permissions.permissions,
        disabled_tools=body.disabled_capabilities,
        max_iterations=config.max_iterations_per_turn,
        max_total_tokens=config.max_tokens_per_session,
    )

    try:
        result = await loop.run(
            messages=messages,
            config=completion_config,
            context={
                "context_type": body.context_type,
                "context_types": context_types,
                "context_id": body.context_id,
                "project": body.project,
            },
            on_event=on_event,
        )
    except Exception as e:
        # Save error message to keep conversation structure valid
        logger.exception("Agent loop failed for session %s", session.session_id)
        error_msg = f"[Error: {type(e).__name__}]"
        await session_manager.add_message(
            session_id=session.session_id,
            role="assistant",
            content=error_msg,
        )
        raise HTTPException(status_code=500, detail=f"Chat failed: {type(e).__name__}")

    # --- Save assistant response to session ---
    tool_calls_data = [
        {"name": tc["name"], "input": tc["input"]}
        for tc in result.tool_calls_made
    ]

    await session_manager.add_message(
        session_id=session.session_id,
        role="assistant",
        content=result.content,
        tool_calls=tool_calls_data or None,
        tokens_used=result.total_output_tokens,
        is_input=False,
    )

    # Update session token counters
    await session_manager.update_tokens(
        session_id=session.session_id,
        input_tokens=result.total_input_tokens,
        output_tokens=result.total_output_tokens,
        cost_per_1k_input=caps.cost_per_1k_input,
        cost_per_1k_output=caps.cost_per_1k_output,
    )

    return ChatResponse(
        session_id=session.session_id,
        content=result.content,
        model=result.model,
        iterations=result.iterations,
        tool_calls=[
            {"name": tc["name"], "input": tc["input"], "result": tc.get("result")}
            for tc in result.tool_calls_made
        ],
        total_input_tokens=result.total_input_tokens,
        total_output_tokens=result.total_output_tokens,
        stop_reason=result.stop_reason,
    )


# ---------------------------------------------------------------------------
# Provider endpoints
# ---------------------------------------------------------------------------

@router.get("/providers")
async def list_providers(
    registry=Depends(get_provider_registry),
) -> dict[str, Any]:
    """List all configured LLM providers."""
    providers = []
    for name in registry.list_providers():
        config = registry._configs.get(name, {})
        providers.append(
            ProviderInfo(
                name=name,
                provider_type=config.get("provider", name),
                default_model=config.get("model", "unknown"),
            )
        )
    return {"providers": [p.model_dump() for p in providers]}


@router.post("/providers/test")
async def test_provider(
    body: ProviderTestRequest,
    registry=Depends(get_provider_registry),
) -> ProviderTestResponse:
    """Test connection to an LLM provider with a simple completion call."""
    from core.llm.provider import (
        CompletionConfig,
        Message,
        ProviderError,
    )

    try:
        provider = registry.get(body.provider)
    except ProviderError as e:
        return ProviderTestResponse(
            provider=body.provider,
            status="error",
            error=str(e),
        )

    try:
        caps = provider.capabilities()
        start = time.monotonic()
        result = await provider.complete(
            messages=[Message(role="user", content="Say 'hello' in one word.")],
            config=CompletionConfig(
                model=caps.model_id,
                max_tokens=16,
                temperature=0.0,
            ),
        )
        latency = int((time.monotonic() - start) * 1000)

        return ProviderTestResponse(
            provider=body.provider,
            status="ok",
            model=result.model,
            latency_ms=latency,
            message=result.content[:200],
        )
    except Exception as e:
        logger.exception("Provider test failed for %s", body.provider)
        return ProviderTestResponse(
            provider=body.provider,
            status="error",
            error=f"Connection failed: {type(e).__name__}",
        )


@router.get("/config")
async def get_config(
    config=Depends(get_llm_config),
) -> dict[str, Any]:
    """Get current LLM configuration (feature flags, permissions, defaults)."""
    return config.model_dump()


@router.put("/config")
async def update_config(
    request: Request,
    body: LLMConfigUpdate,
    config=Depends(get_llm_config),
) -> dict[str, Any]:
    """Update LLM configuration. Partial updates supported."""
    import json
    from pathlib import Path
    from app.config import settings as app_settings
    from app.models.llm_config import LLMConfig

    # Build updated config from current + partial update
    current = config.model_dump()

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            if key == "permissions" and isinstance(value, dict):
                # Deep merge: preserve unmentioned modules and fields
                for module, perms in value.items():
                    if module in current["permissions"]:
                        current["permissions"][module].update(
                            perms if isinstance(perms, dict) else perms.model_dump()
                        )
                    else:
                        current["permissions"][module] = (
                            perms if isinstance(perms, dict) else perms.model_dump()
                        )
            elif key == "feature_flags" and isinstance(value, dict):
                current["feature_flags"].update(
                    value if isinstance(value, dict) else value.model_dump()
                )
            else:
                current[key] = value

    updated = LLMConfig(**current)

    # Update in-memory config
    request.app.state.llm_config = updated

    # Persist to _global/llm_config.json
    config_dir = Path(app_settings.json_data_dir) / "_global"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "llm_config.json"
    config_path.write_text(
        json.dumps(updated.model_dump(), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return updated.model_dump()


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(
    limit: int = 50,
    manager=Depends(get_session_manager),
) -> dict[str, Any]:
    """List active LLM chat sessions."""
    sessions = await manager.list_sessions(limit=limit)
    return {"sessions": sessions, "count": len(sessions)}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    manager=Depends(get_session_manager),
) -> dict[str, Any]:
    """Get a chat session with full message history."""
    from fastapi import HTTPException

    session = await manager.load(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found or expired")
    return session.to_dict()


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    manager=Depends(get_session_manager),
) -> dict[str, Any]:
    """Delete a chat session."""
    from fastapi import HTTPException

    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {"deleted": True, "session_id": session_id}

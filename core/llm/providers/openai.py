"""
OpenAI LLM provider.

Implements LLMProvider Protocol using the OpenAI Chat Completions API.
Requires: openai package (pip install openai).
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from core.llm.provider import (
    CompletionConfig,
    CompletionResult,
    Message,
    ProviderCapabilities,
    ProviderError,
    StreamChunk,
    TokenUsage,
    ToolDefinition,
)

_MODEL_CAPS: dict[str, dict[str, Any]] = {
    "gpt-4o": {
        "max_context_window": 128_000,
        "max_output_tokens": 16_384,
        "supports_vision": True,
        "cost_input": 0.0025,
        "cost_output": 0.01,
    },
    "gpt-4o-mini": {
        "max_context_window": 128_000,
        "max_output_tokens": 16_384,
        "supports_vision": True,
        "cost_input": 0.00015,
        "cost_output": 0.0006,
    },
    "gpt-4-turbo": {
        "max_context_window": 128_000,
        "max_output_tokens": 4_096,
        "supports_vision": True,
        "cost_input": 0.01,
        "cost_output": 0.03,
    },
    "o1": {
        "max_context_window": 200_000,
        "max_output_tokens": 100_000,
        "supports_vision": True,
        "cost_input": 0.015,
        "cost_output": 0.06,
    },
}

_DEFAULT_CAPS = {
    "max_context_window": 128_000,
    "max_output_tokens": 4_096,
    "supports_vision": False,
    "cost_input": 0.002,
    "cost_output": 0.008,
}


def _convert_tools(tools: list[ToolDefinition] | None) -> list[dict] | None:
    """Convert generic ToolDefinition list to OpenAI function calling format."""
    if not tools:
        return None
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters if t.parameters else {"type": "object", "properties": {}},
            },
        }
        for t in tools
    ]


def _convert_messages(messages: list[Message], config: CompletionConfig) -> list[dict]:
    """Convert to OpenAI message format."""
    api_msgs: list[dict] = []

    if config.system_prompt:
        api_msgs.append({"role": "system", "content": config.system_prompt})

    for msg in messages:
        if msg.role == "tool":
            api_msgs.append({
                "role": "tool",
                "tool_call_id": msg.tool_call_id or "",
                "content": msg.content,
            })
        else:
            api_msgs.append({
                "role": msg.role,
                "content": msg.content,
            })

    return api_msgs


class OpenAIProvider:
    """LLM provider for OpenAI models (GPT-4o, o1, etc.).

    Args:
        api_key: OpenAI API key.
        model: Default model ID.
        base_url: Optional custom base URL (for Azure OpenAI or proxies).
        organization: Optional OpenAI organization ID.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        base_url: str | None = None,
        organization: str | None = None,
    ) -> None:
        try:
            import openai
        except ImportError as e:
            raise ImportError(
                "openai package required: pip install openai"
            ) from e

        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        if organization:
            kwargs["organization"] = organization
        self._client = openai.AsyncOpenAI(**kwargs)
        self._model = model

    async def complete(
        self,
        messages: list[Message],
        config: CompletionConfig,
    ) -> CompletionResult:
        model = config.model or self._model
        api_msgs = _convert_messages(messages, config)

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": api_msgs,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
        }
        tools = _convert_tools(config.tools)
        if tools:
            kwargs["tools"] = tools
        if config.stop_sequences:
            kwargs["stop"] = config.stop_sequences
        if config.response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await self._client.chat.completions.create(**kwargs)
        except Exception as e:
            raise ProviderError(f"OpenAI API error: {e}") from e

        choice = response.choices[0]
        content = choice.message.content or ""

        # Include tool calls in content if present
        if choice.message.tool_calls:
            tool_results = []
            for tc in choice.message.tool_calls:
                tool_results.append({
                    "tool_call": {
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    }
                })
            if tool_results:
                content += json.dumps(tool_results)

        usage = TokenUsage()
        if response.usage:
            usage = TokenUsage(
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
            )

        return CompletionResult(
            content=content,
            model=response.model or model,
            usage=usage,
            stop_reason=choice.finish_reason or "",
        )

    async def stream(
        self,
        messages: list[Message],
        config: CompletionConfig,
    ) -> AsyncIterator[StreamChunk]:
        model = config.model or self._model
        api_msgs = _convert_messages(messages, config)

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": api_msgs,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        tools = _convert_tools(config.tools)
        if tools:
            kwargs["tools"] = tools
        if config.stop_sequences:
            kwargs["stop"] = config.stop_sequences
        if config.response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        try:
            stream = await self._client.chat.completions.create(**kwargs)
            async for chunk in stream:
                if not chunk.choices:
                    # Usage-only chunk at end
                    if chunk.usage:
                        yield StreamChunk(
                            content="",
                            is_final=True,
                            usage=TokenUsage(
                                input_tokens=chunk.usage.prompt_tokens,
                                output_tokens=chunk.usage.completion_tokens,
                            ),
                        )
                    continue

                delta = chunk.choices[0].delta
                finish = chunk.choices[0].finish_reason

                text = delta.content or "" if delta else ""

                if finish:
                    # Don't mark as final here — wait for usage-only chunk
                    if text:
                        yield StreamChunk(content=text)
                elif text:
                    yield StreamChunk(content=text)
        except Exception as e:
            raise ProviderError(f"OpenAI streaming error: {e}") from e

    def capabilities(self) -> ProviderCapabilities:
        caps = _MODEL_CAPS.get(self._model, _DEFAULT_CAPS)
        return ProviderCapabilities(
            provider_name="openai",
            model_id=self._model,
            max_context_window=caps["max_context_window"],
            max_output_tokens=caps["max_output_tokens"],
            supports_streaming=True,
            supports_tool_use=True,
            supports_json_mode=True,
            supports_vision=caps["supports_vision"],
            supports_thinking=False,
            cost_per_1k_input=caps["cost_input"],
            cost_per_1k_output=caps["cost_output"],
        )

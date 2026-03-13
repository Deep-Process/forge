"""Text-based tool adapter for LLM providers without native tool_use.

When the LLM provider doesn't support function calling (e.g., Claude Code CLI),
this module bridges the gap:

1. build_text_tool_prompt() — injects tool schemas into the system prompt
2. parse_text_tool_calls() — extracts <forge_tool> blocks from LLM text
3. format_tool_results() — formats execution results as a user message

The agent loop uses these to create a multi-turn tool-use conversation
that works identically to native tool_use, just via text parsing.
"""

from __future__ import annotations

import json
import re
from typing import Any

# Pattern to match <forge_tool>...</forge_tool> blocks
_TOOL_CALL_RE = re.compile(
    r"<forge_tool>\s*(.*?)\s*</forge_tool>",
    re.DOTALL,
)


def _summarize_params(parameters: dict) -> str:
    """Summarize JSON Schema parameters into compact text.

    Format: param_name* (type) for required, param_name (type) for optional.
    """
    props = parameters.get("properties", {})
    required = set(parameters.get("required", []))

    if not props:
        return "(none)"

    parts: list[str] = []
    for name, schema in props.items():
        ptype = schema.get("type", "any")
        req_mark = "*" if name in required else ""
        parts.append(f"{name}{req_mark} ({ptype})")

    return ", ".join(parts)


def build_text_tool_prompt(tools: list[Any]) -> str:
    """Build compact tool-use instructions for injection into system prompt.

    Args:
        tools: List of ToolDef objects with name, description, parameters.

    Returns:
        Markdown text (~30 tokens per tool) with calling instructions.
    """
    lines: list[str] = [
        "## Tool Use",
        "",
        "You have tools available. To call a tool, output a <forge_tool> block:",
        "",
        "<forge_tool>",
        '{"name": "toolName", "input": {"param1": "value1"}}',
        "</forge_tool>",
        "",
        "Rules:",
        "- You may call multiple tools in one response (multiple <forge_tool> blocks).",
        "- After tool execution, you'll receive results and can call more tools or respond.",
        "- When done with tools, respond in plain text (no <forge_tool> blocks).",
        "- Always include the `project` parameter for project-scoped tools.",
        "- Parameters marked with * are required.",
        "",
        "### Available Tools",
        "",
    ]

    for tool in tools:
        name = tool.name
        desc = tool.description
        params = _summarize_params(tool.parameters) if tool.parameters else "(none)"
        lines.append(f"**{name}** — {desc}")
        lines.append(f"  Params: {params}")

    return "\n".join(lines)


def parse_text_tool_calls(content: str) -> tuple[str, list[dict]]:
    """Parse <forge_tool> blocks from LLM response text.

    Args:
        content: The full LLM response text.

    Returns:
        (clean_text, tool_calls) where:
        - clean_text: response with <forge_tool> blocks removed and stripped
        - tool_calls: list of {"id": "tt-NNN", "name": str, "input": dict}
    """
    matches = list(_TOOL_CALL_RE.finditer(content))
    if not matches:
        return content, []

    tool_calls: list[dict] = []
    for i, match in enumerate(matches):
        raw_json = match.group(1).strip()
        call_id = f"tt-{i:03d}"

        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError as e:
            # Return parse error — LLM can see this and retry
            tool_calls.append({
                "id": call_id,
                "name": "__parse_error__",
                "input": {"raw": raw_json[:500], "error": str(e)},
            })
            continue

        if not isinstance(data, dict):
            tool_calls.append({
                "id": call_id,
                "name": "__parse_error__",
                "input": {"raw": raw_json[:500], "error": "Expected JSON object"},
            })
            continue

        name = data.get("name", "")
        tool_input = data.get("input", {})

        if not name:
            tool_calls.append({
                "id": call_id,
                "name": "__parse_error__",
                "input": {"raw": raw_json[:500], "error": "Missing 'name' field"},
            })
            continue

        tool_calls.append({
            "id": call_id,
            "name": name,
            "input": tool_input if isinstance(tool_input, dict) else {},
        })

    # Remove <forge_tool> blocks from the text
    clean = _TOOL_CALL_RE.sub("", content).strip()

    return clean, tool_calls


def format_tool_results(results: list[dict[str, Any]]) -> str:
    """Format tool execution results as a user message.

    Args:
        results: List of {"name": str, "id": str, "result": dict}

    Returns:
        Formatted text suitable for injection as a user message.
    """
    parts: list[str] = ["[Tool Results]", ""]

    for r in results:
        name = r.get("name", "unknown")
        try:
            result_str = json.dumps(r.get("result", {}), ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            result_str = str(r.get("result", {}))

        # Truncate large results to avoid context bloat
        if len(result_str) > 4000:
            result_str = result_str[:4000] + "... (truncated)"

        parts.append(f"{name} →")
        parts.append(result_str)
        parts.append("")

    return "\n".join(parts).rstrip()

"""agentskills.io spec compliance validation for skills.

Validates skill names, descriptions, structure, and SKILL.md content
against the agentskills.io specification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    """Result of skill validation."""
    valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.valid = False

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)

    def merge(self, other: "ValidationResult") -> None:
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        if not other.valid:
            self.valid = False

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
        }


_NAME_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")


def validate_skill_name(name: str) -> ValidationResult:
    """Validate skill name: 1-64 chars, lowercase + hyphens, no consecutive
    hyphens, no leading/trailing hyphen."""
    result = ValidationResult()

    if not name:
        result.add_error("Skill name is required")
        return result

    if len(name) > 64:
        result.add_error(f"Skill name too long ({len(name)} chars, max 64)")

    if len(name) < 1:
        result.add_error("Skill name must be at least 1 character")

    if not _NAME_RE.match(name):
        result.add_error(
            "Skill name must be lowercase letters, digits, and hyphens only. "
            "Must start with a letter. No consecutive, leading, or trailing hyphens."
        )

    return result


def validate_skill_description(desc: str) -> ValidationResult:
    """Validate skill description: 1-1024 chars, non-empty."""
    result = ValidationResult()

    if not desc or not desc.strip():
        result.add_error("Skill description is required and cannot be empty")
        return result

    if len(desc) > 1024:
        result.add_error(f"Skill description too long ({len(desc)} chars, max 1024)")

    return result


def validate_skill_md_length(content: str) -> ValidationResult:
    """Warn if SKILL.md exceeds 500 lines."""
    result = ValidationResult()
    if not content:
        return result

    line_count = content.count("\n") + 1
    if line_count > 500:
        result.add_warning(
            f"SKILL.md is {line_count} lines (recommended max 500). "
            "Consider moving details to scripts/ or references/."
        )

    return result


def validate_frontmatter(content: str) -> ValidationResult:
    """Validate YAML frontmatter has required fields (name, description)."""
    result = ValidationResult()
    if not content:
        result.add_error("SKILL.md content is empty")
        return result

    # Check for frontmatter delimiters
    stripped = content.strip()
    if not stripped.startswith("---"):
        result.add_error("SKILL.md must start with YAML frontmatter (---)")
        return result

    # Find closing delimiter
    second_delim = stripped.find("---", 3)
    if second_delim == -1:
        result.add_error("SKILL.md frontmatter is not closed (missing closing ---)")
        return result

    fm_text = stripped[3:second_delim].strip()
    if not fm_text:
        result.add_error("SKILL.md frontmatter is empty")
        return result

    # Simple key extraction (avoid heavy YAML dependency)
    keys_found = set()
    for line in fm_text.split("\n"):
        line = line.strip()
        if ":" in line and not line.startswith("#"):
            key = line.split(":", 1)[0].strip()
            keys_found.add(key)

    if "name" not in keys_found:
        result.add_error("Frontmatter missing required field: name")
    if "description" not in keys_found:
        result.add_error("Frontmatter missing required field: description")

    return result


_KNOWN_TOOLS = {
    "Read", "Write", "Edit", "Glob", "Grep", "Bash",
    "WebSearch", "WebFetch", "Task", "NotebookEdit",
}


def validate_allowed_tools(tools: list[str] | str | None) -> ValidationResult:
    """Validate allowed-tools list."""
    result = ValidationResult()
    if tools is None:
        return result

    if isinstance(tools, str):
        tool_list = [t.strip() for t in tools.replace(",", " ").split() if t.strip()]
    else:
        tool_list = tools

    for tool in tool_list:
        if tool not in _KNOWN_TOOLS:
            result.add_warning(f"Unknown tool in allowed-tools: {tool}")

    return result


def validate_skill_structure(skill_data: dict) -> ValidationResult:
    """Run all validations on a skill dict. Returns combined result."""
    result = ValidationResult()

    name = skill_data.get("name", "")
    result.merge(validate_skill_name(name))

    desc = skill_data.get("description", "")
    result.merge(validate_skill_description(desc))

    content = skill_data.get("skill_md_content", "")
    if content:
        result.merge(validate_skill_md_length(content))
        result.merge(validate_frontmatter(content))

    return result

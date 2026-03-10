"""Tests for core.decisions — unified decision/exploration/risk log.

Tests cover:
- Dedup by (task_id, type, issue) composite key
- Type validation: all 14 types + exploration + risk
- Risk lifecycle: OPEN -> ANALYZING -> MITIGATED -> CLOSED
- Special task_ids: PLANNING, DISCOVERY, I-NNN accepted
- Status transition validation
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "core"))

from decisions import (
    CONTRACTS,
    VALID_STATUS_TRANSITIONS,
    cmd_add,
    cmd_update,
    load_or_create,
    save_json,
    decisions_path,
)
from contracts import validate_contract, atomic_write_json


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_args(project, data_list):
    return SimpleNamespace(project=project, data=json.dumps(data_list))


def _update_args(project, data_list):
    return SimpleNamespace(project=project, data=json.dumps(data_list))


def _add_decision(project, task_id="T-001", dtype="architecture",
                  issue="Test issue", recommendation="Do X",
                  status="OPEN", **kwargs):
    """Add a single decision and return the store."""
    data = [{
        "task_id": task_id,
        "type": dtype,
        "issue": issue,
        "recommendation": recommendation,
        "status": status,
        **kwargs,
    }]
    cmd_add(_add_args(project, data))
    return load_or_create(project)


# ---------------------------------------------------------------------------
# Dedup by (task_id, type, issue)
# ---------------------------------------------------------------------------

class TestDedup:
    """Tests for decision deduplication."""

    def test_same_composite_key_deduped(self, forge_env, project_name):
        """Adding a decision with same (task_id, type, issue) is skipped."""
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="JWT algorithm")
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="JWT algorithm")

        store = load_or_create(project_name)
        assert len(store["decisions"]) == 1

    def test_different_task_id_not_deduped(self, forge_env, project_name):
        """Same type+issue but different task_id -> NOT a duplicate."""
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="JWT algorithm")
        _add_decision(project_name, task_id="T-002", dtype="architecture",
                      issue="JWT algorithm")

        store = load_or_create(project_name)
        assert len(store["decisions"]) == 2

    def test_different_type_not_deduped(self, forge_env, project_name):
        """Same task_id+issue but different type -> NOT a duplicate."""
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="JWT algorithm")
        _add_decision(project_name, task_id="T-001", dtype="security",
                      issue="JWT algorithm")

        store = load_or_create(project_name)
        assert len(store["decisions"]) == 2

    def test_different_issue_not_deduped(self, forge_env, project_name):
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="Issue A")
        _add_decision(project_name, task_id="T-001", dtype="architecture",
                      issue="Issue B")

        store = load_or_create(project_name)
        assert len(store["decisions"]) == 2


# ---------------------------------------------------------------------------
# Type validation
# ---------------------------------------------------------------------------

class TestTypeValidation:
    """Tests for decision type enum validation."""

    ALL_VALID_TYPES = {
        "architecture", "implementation", "dependency", "security",
        "performance", "testing", "naming", "convention", "constraint",
        "business", "strategy", "other", "exploration", "risk",
    }

    def test_all_14_types_accepted(self):
        """All valid types should pass contract validation."""
        spec = CONTRACTS["add"]
        for dtype in self.ALL_VALID_TYPES:
            data = [{
                "task_id": "T-001",
                "type": dtype,
                "issue": "Test",
                "recommendation": "Do X",
            }]
            errors = validate_contract(spec, data)
            assert errors == [], f"type='{dtype}' should be valid but got: {errors}"

    def test_invalid_type_rejected(self):
        spec = CONTRACTS["add"]
        data = [{
            "task_id": "T-001",
            "type": "INVALID_TYPE",
            "issue": "Test",
            "recommendation": "Do X",
        }]
        errors = validate_contract(spec, data)
        assert any("type" in e for e in errors)

    def test_exploration_type_carries_extra_fields(self, forge_env, project_name):
        """type=exploration should store exploration-specific fields."""
        store = _add_decision(
            project_name,
            dtype="exploration",
            issue="Architecture options",
            exploration_type="architecture",
            findings=["Finding 1", "Finding 2"],
            options=[{"name": "Redis", "pros": ["fast"], "cons": ["infra"]}],
            open_questions=["What about caching?"],
        )
        d = store["decisions"][0]
        assert d["type"] == "exploration"
        assert d["exploration_type"] == "architecture"
        assert len(d["findings"]) == 2
        assert len(d["options"]) == 1
        assert len(d["open_questions"]) == 1

    def test_risk_type_carries_severity_likelihood(self, forge_env, project_name):
        """type=risk should store severity, likelihood, mitigation fields."""
        store = _add_decision(
            project_name,
            dtype="risk",
            issue="Cache stampede",
            severity="HIGH",
            likelihood="MEDIUM",
            linked_entity_type="idea",
            linked_entity_id="I-001",
            mitigation_plan="Circuit breaker pattern",
        )
        d = store["decisions"][0]
        assert d["type"] == "risk"
        assert d["severity"] == "HIGH"
        assert d["likelihood"] == "MEDIUM"
        assert d["linked_entity_type"] == "idea"
        assert d["linked_entity_id"] == "I-001"
        assert d["mitigation_plan"] == "Circuit breaker pattern"


# ---------------------------------------------------------------------------
# Risk lifecycle
# ---------------------------------------------------------------------------

class TestRiskLifecycle:
    """Tests for risk status transitions: OPEN -> ANALYZING -> MITIGATED -> CLOSED."""

    def test_open_to_analyzing(self, forge_env, project_name):
        _add_decision(project_name, dtype="risk", issue="Risk A",
                      severity="HIGH", likelihood="MEDIUM")

        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "ANALYZING"}]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "ANALYZING"

    def test_analyzing_to_mitigated(self, forge_env, project_name):
        _add_decision(project_name, dtype="risk", issue="Risk A",
                      severity="HIGH", likelihood="MEDIUM")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "ANALYZING"}]))
        cmd_update(_update_args(project_name, [{
            "id": "D-001",
            "status": "MITIGATED",
            "mitigation_plan": "Added circuit breaker",
        }]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "MITIGATED"
        assert store["decisions"][0]["mitigation_plan"] == "Added circuit breaker"

    def test_mitigated_to_closed(self, forge_env, project_name):
        _add_decision(project_name, dtype="risk", issue="Risk A",
                      severity="HIGH", likelihood="MEDIUM")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "ANALYZING"}]))
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "MITIGATED"}]))
        cmd_update(_update_args(project_name, [{
            "id": "D-001",
            "status": "CLOSED",
            "resolution_notes": "Verified circuit breaker works",
        }]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "CLOSED"
        assert "circuit breaker" in store["decisions"][0]["resolution_notes"]

    def test_open_to_accepted(self, forge_env, project_name):
        _add_decision(project_name, dtype="risk", issue="Risk B",
                      severity="LOW", likelihood="LOW")
        cmd_update(_update_args(project_name, [{
            "id": "D-001",
            "status": "ACCEPTED",
            "resolution_notes": "Risk accepted — low impact",
        }]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "ACCEPTED"

    def test_invalid_transition_rejected(self, forge_env, project_name):
        """MITIGATED -> ANALYZING is not a valid transition."""
        _add_decision(project_name, dtype="risk", issue="Risk A",
                      severity="HIGH", likelihood="MEDIUM")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "ANALYZING"}]))
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "MITIGATED"}]))

        # MITIGATED -> ANALYZING not valid
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "ANALYZING"}]))
        store = load_or_create(project_name)
        # Should remain MITIGATED
        assert store["decisions"][0]["status"] == "MITIGATED"

    def test_closed_can_reopen(self, forge_env, project_name):
        """CLOSED -> OPEN is valid (reopen a decision)."""
        _add_decision(project_name, dtype="architecture", issue="DB choice")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "CLOSED"}]))
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "OPEN"}]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "OPEN"

    def test_deferred_to_open(self, forge_env, project_name):
        """DEFERRED -> OPEN is valid."""
        _add_decision(project_name, dtype="architecture", issue="API style")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "DEFERRED"}]))
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "OPEN"}]))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "OPEN"

    def test_valid_status_transitions_complete(self):
        """All statuses in the enum have entries in VALID_STATUS_TRANSITIONS."""
        all_statuses = {"OPEN", "CLOSED", "DEFERRED", "ANALYZING", "MITIGATED", "ACCEPTED"}
        assert set(VALID_STATUS_TRANSITIONS.keys()) == all_statuses


# ---------------------------------------------------------------------------
# Special task_ids
# ---------------------------------------------------------------------------

class TestSpecialTaskIds:
    """Tests for special task_id values."""

    def test_planning_task_id_accepted(self, forge_env, project_name):
        """PLANNING is a valid special task_id."""
        store = _add_decision(project_name, task_id="PLANNING",
                              issue="Project scope")
        assert store["decisions"][0]["task_id"] == "PLANNING"

    def test_discovery_task_id_accepted(self, forge_env, project_name):
        """DISCOVERY is a valid special task_id."""
        store = _add_decision(project_name, task_id="DISCOVERY",
                              issue="Technology assessment")
        assert store["decisions"][0]["task_id"] == "DISCOVERY"

    def test_idea_task_id_accepted(self, forge_env, project_name):
        """I-NNN format is accepted as task_id for exploration decisions."""
        store = _add_decision(project_name, task_id="I-001",
                              dtype="exploration",
                              issue="Architecture options")
        assert store["decisions"][0]["task_id"] == "I-001"

    def test_regular_task_id_accepted(self, forge_env, project_name):
        """Standard T-NNN task_id works."""
        store = _add_decision(project_name, task_id="T-001",
                              issue="Implementation choice")
        assert store["decisions"][0]["task_id"] == "T-001"


# ---------------------------------------------------------------------------
# Open count tracking
# ---------------------------------------------------------------------------

class TestOpenCount:
    """Tests for open_count field in decisions store."""

    def test_open_count_increments(self, forge_env, project_name):
        _add_decision(project_name, issue="Issue 1")
        _add_decision(project_name, issue="Issue 2")
        store = load_or_create(project_name)
        assert store["open_count"] == 2

    def test_open_count_decrements_on_close(self, forge_env, project_name):
        _add_decision(project_name, issue="Issue 1")
        _add_decision(project_name, issue="Issue 2")
        cmd_update(_update_args(project_name, [{"id": "D-001", "status": "CLOSED"}]))
        store = load_or_create(project_name)
        assert store["open_count"] == 1


# ---------------------------------------------------------------------------
# Contract validation
# ---------------------------------------------------------------------------

class TestDecisionsContract:
    """Tests for decisions contract specs."""

    def test_add_requires_task_id_type_issue_recommendation(self):
        data = [{"recommendation": "Do X"}]
        errors = validate_contract(CONTRACTS["add"], data)
        assert any("task_id" in e for e in errors)
        assert any("type" in e for e in errors)
        assert any("issue" in e for e in errors)

    def test_add_valid_minimal(self):
        data = [{
            "task_id": "T-001",
            "type": "architecture",
            "issue": "DB choice",
            "recommendation": "PostgreSQL",
        }]
        errors = validate_contract(CONTRACTS["add"], data)
        assert errors == []

    def test_update_requires_id(self):
        data = [{"status": "CLOSED"}]
        errors = validate_contract(CONTRACTS["update"], data)
        assert any("id" in e for e in errors)

    def test_update_invalid_action_rejected(self):
        data = [{"id": "D-001", "action": "INVALID"}]
        errors = validate_contract(CONTRACTS["update"], data)
        assert any("action" in e for e in errors)

    def test_override_fields_stored(self, forge_env, project_name):
        """Override value and reason are stored on update."""
        _add_decision(project_name, issue="Algorithm choice")
        cmd_update(_update_args(project_name, [{
            "id": "D-001",
            "status": "CLOSED",
            "action": "override",
            "override_value": "HS256",
            "override_reason": "Simpler for MVP",
        }]))
        store = load_or_create(project_name)
        d = store["decisions"][0]
        assert d["status"] == "CLOSED"
        assert d["override_value"] == "HS256"
        assert d["override_reason"] == "Simpler for MVP"

    def test_id_auto_increments(self, forge_env, project_name):
        """Decision IDs auto-increment: D-001, D-002, etc."""
        _add_decision(project_name, issue="First")
        _add_decision(project_name, issue="Second")
        store = load_or_create(project_name)
        assert store["decisions"][0]["id"] == "D-001"
        assert store["decisions"][1]["id"] == "D-002"

    def test_default_status_is_open(self, forge_env, project_name):
        """Decisions default to OPEN status."""
        data = [{
            "task_id": "T-001",
            "type": "architecture",
            "issue": "Test",
            "recommendation": "Do X",
        }]
        cmd_add(_add_args(project_name, data))
        store = load_or_create(project_name)
        assert store["decisions"][0]["status"] == "OPEN"

    def test_tags_stored(self, forge_env, project_name):
        """Tags are stored on decisions."""
        store = _add_decision(project_name, issue="Tagged decision",
                              tags=["perf", "caching"])
        assert store["decisions"][0]["tags"] == ["perf", "caching"]

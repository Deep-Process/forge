"""Tests for core.ideas — staging area for proposals.

Tests cover:
- Status transitions: DRAFT->EXPLORING->APPROVED->COMMITTED (valid)
- Invalid transitions (DRAFT->APPROVED)
- Relations append-merge on update
- Parent-child hierarchy
- commit command validates depends_on
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "core"))

from ideas import (
    CONTRACTS,
    VALID_TRANSITIONS,
    VALID_RELATION_TYPES,
    cmd_add,
    cmd_update,
    cmd_commit,
    load_or_create,
    save_json,
    ideas_path,
    _get_parent_chain,
)
from contracts import validate_contract, atomic_write_json


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_args(project, data_list):
    return SimpleNamespace(project=project, data=json.dumps(data_list))


def _update_args(project, data_list):
    return SimpleNamespace(project=project, data=json.dumps(data_list))


def _commit_args(project, idea_id):
    return SimpleNamespace(project=project, idea_id=idea_id)


def _add_idea(project, title="Test Idea", description="A test idea",
              category="feature", priority="MEDIUM", parent_id=None,
              relations=None, scopes=None, advances_key_results=None):
    """Add a single idea and return the store."""
    data = [{
        "title": title,
        "description": description,
        "category": category,
        "priority": priority,
    }]
    if parent_id:
        data[0]["parent_id"] = parent_id
    if relations:
        data[0]["relations"] = relations
    if scopes:
        data[0]["scopes"] = scopes
    if advances_key_results:
        data[0]["advances_key_results"] = advances_key_results
    cmd_add(_add_args(project, data))
    return load_or_create(project)


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

class TestStatusTransitions:
    """Tests for the idea lifecycle state machine."""

    def test_valid_draft_to_exploring(self, forge_env, project_name):
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "EXPLORING"

    def test_valid_exploring_to_approved(self, forge_env, project_name):
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "APPROVED"

    def test_valid_approved_to_committed_via_commit(self, forge_env, project_name):
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        cmd_commit(_commit_args(project_name, "I-001"))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "COMMITTED"
        assert store["ideas"][0]["committed_at"] is not None

    def test_invalid_draft_to_approved_rejected(self, forge_env, project_name):
        """DRAFT -> APPROVED is not a valid transition (must explore first)."""
        _add_idea(project_name)
        # Attempt invalid transition — cmd_update should print warning and skip
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        store = load_or_create(project_name)
        # Status should remain DRAFT
        assert store["ideas"][0]["status"] == "DRAFT"

    def test_invalid_draft_to_committed_rejected(self, forge_env, project_name):
        """COMMITTED is set only by cmd_commit, not update.
        The update contract does not even include COMMITTED as a valid
        status value, so it fails at contract validation with SystemExit."""
        _add_idea(project_name)
        with pytest.raises(SystemExit):
            cmd_update(_update_args(project_name, [{"id": "I-001", "status": "COMMITTED"}]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "DRAFT"

    def test_commit_requires_approved_status(self, forge_env, project_name):
        """commit should fail if idea is not APPROVED."""
        _add_idea(project_name)
        with pytest.raises(SystemExit):
            cmd_commit(_commit_args(project_name, "I-001"))

    def test_exploring_to_rejected(self, forge_env, project_name):
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [
            {"id": "I-001", "status": "REJECTED", "rejection_reason": "Too risky"}
        ]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "REJECTED"
        assert store["ideas"][0]["rejection_reason"] == "Too risky"

    def test_rejected_to_draft_reopen(self, forge_env, project_name):
        """Rejected ideas can be reopened to DRAFT."""
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "REJECTED"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "DRAFT"}]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "DRAFT"

    def test_committed_is_terminal(self, forge_env, project_name):
        """COMMITTED ideas cannot transition to any other status."""
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        cmd_commit(_commit_args(project_name, "I-001"))
        # Attempt to change status — should be rejected
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "DRAFT"}]))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "COMMITTED"

    def test_valid_transitions_map_completeness(self):
        """Verify all status values have entries in VALID_TRANSITIONS."""
        all_statuses = {"DRAFT", "EXPLORING", "APPROVED", "COMMITTED", "REJECTED"}
        assert set(VALID_TRANSITIONS.keys()) == all_statuses


# ---------------------------------------------------------------------------
# Relations
# ---------------------------------------------------------------------------

class TestRelations:
    """Tests for idea relations (append-merge on update)."""

    def test_relations_added_on_create(self, forge_env, project_name):
        _add_idea(project_name, title="Parent")
        _add_idea(project_name, title="Child",
                  relations=[{"type": "depends_on", "target_id": "I-001"}])

        store = load_or_create(project_name)
        child = store["ideas"][1]
        assert len(child["relations"]) == 1
        assert child["relations"][0]["type"] == "depends_on"
        assert child["relations"][0]["target_id"] == "I-001"

    def test_relations_append_merged_on_update(self, forge_env, project_name):
        """New relations are ADDED to existing ones, not replaced."""
        _add_idea(project_name, title="Idea A")
        _add_idea(project_name, title="Idea B")
        _add_idea(project_name, title="Idea C",
                  relations=[{"type": "depends_on", "target_id": "I-001"}])

        # Add another relation via update
        cmd_update(_update_args(project_name, [{
            "id": "I-003",
            "relations": [{"type": "related_to", "target_id": "I-002"}],
        }]))

        store = load_or_create(project_name)
        idea_c = store["ideas"][2]
        assert len(idea_c["relations"]) == 2
        types = {r["type"] for r in idea_c["relations"]}
        assert types == {"depends_on", "related_to"}

    def test_duplicate_relations_not_added(self, forge_env, project_name):
        """Same (type, target_id) should not be added twice."""
        _add_idea(project_name, title="Idea A")
        _add_idea(project_name, title="Idea B",
                  relations=[{"type": "depends_on", "target_id": "I-001"}])

        # Try adding same relation again
        cmd_update(_update_args(project_name, [{
            "id": "I-002",
            "relations": [{"type": "depends_on", "target_id": "I-001"}],
        }]))

        store = load_or_create(project_name)
        assert len(store["ideas"][1]["relations"]) == 1

    def test_valid_relation_types(self):
        """Check all valid relation types are accepted."""
        expected = {"depends_on", "related_to", "supersedes", "duplicates"}
        assert VALID_RELATION_TYPES == expected


# ---------------------------------------------------------------------------
# Parent-child hierarchy
# ---------------------------------------------------------------------------

class TestParentChild:
    """Tests for parent_id hierarchy."""

    def test_parent_id_set_on_add(self, forge_env, project_name):
        _add_idea(project_name, title="Parent")
        _add_idea(project_name, title="Child", parent_id="I-001")

        store = load_or_create(project_name)
        assert store["ideas"][1]["parent_id"] == "I-001"

    def test_root_idea_has_no_parent(self, forge_env, project_name):
        _add_idea(project_name, title="Root")
        store = load_or_create(project_name)
        assert store["ideas"][0]["parent_id"] is None

    def test_parent_chain_helper(self):
        """_get_parent_chain builds correct chain."""
        ideas = [
            {"id": "I-001", "parent_id": None},
            {"id": "I-002", "parent_id": "I-001"},
            {"id": "I-003", "parent_id": "I-002"},
        ]
        chain = _get_parent_chain(ideas, "I-003")
        assert chain == ["I-001", "I-002", "I-003"]

    def test_parent_chain_root_returns_empty(self):
        """Root ideas (no parent) return empty chain."""
        ideas = [{"id": "I-001", "parent_id": None}]
        chain = _get_parent_chain(ideas, "I-001")
        assert chain == []

    def test_parent_chain_cycle_protection(self):
        """Cycle in parent_id should not loop infinitely."""
        ideas = [
            {"id": "I-001", "parent_id": "I-002"},
            {"id": "I-002", "parent_id": "I-001"},
        ]
        chain = _get_parent_chain(ideas, "I-001")
        # Should terminate (not infinite loop), result contains both
        assert "I-001" in chain
        assert "I-002" in chain


# ---------------------------------------------------------------------------
# commit validates depends_on
# ---------------------------------------------------------------------------

class TestCommitValidation:
    """Tests for commit command dependency validation."""

    def test_commit_fails_when_dependency_not_approved(self, forge_env, project_name):
        """commit should fail if depends_on target is not APPROVED/COMMITTED."""
        _add_idea(project_name, title="Dependency")
        _add_idea(project_name, title="Dependent",
                  relations=[{"type": "depends_on", "target_id": "I-001"}])

        # Move I-002 through to APPROVED
        cmd_update(_update_args(project_name, [{"id": "I-002", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-002", "status": "APPROVED"}]))

        # I-001 is still DRAFT — commit should fail
        with pytest.raises(SystemExit):
            cmd_commit(_commit_args(project_name, "I-002"))

    def test_commit_succeeds_when_dependency_approved(self, forge_env, project_name):
        """commit succeeds when all depends_on targets are APPROVED."""
        _add_idea(project_name, title="Dependency")
        _add_idea(project_name, title="Dependent",
                  relations=[{"type": "depends_on", "target_id": "I-001"}])

        # Approve both
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        cmd_update(_update_args(project_name, [{"id": "I-002", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-002", "status": "APPROVED"}]))

        cmd_commit(_commit_args(project_name, "I-002"))
        store = load_or_create(project_name)
        assert store["ideas"][1]["status"] == "COMMITTED"

    def test_commit_succeeds_when_no_depends_on(self, forge_env, project_name):
        """Ideas without depends_on can be committed freely."""
        _add_idea(project_name, title="Independent")
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "EXPLORING"}]))
        cmd_update(_update_args(project_name, [{"id": "I-001", "status": "APPROVED"}]))
        cmd_commit(_commit_args(project_name, "I-001"))
        store = load_or_create(project_name)
        assert store["ideas"][0]["status"] == "COMMITTED"


# ---------------------------------------------------------------------------
# Contract validation for ideas
# ---------------------------------------------------------------------------

class TestIdeasContract:
    """Tests for ideas contract specs."""

    def test_add_requires_title_and_description(self):
        data = [{"category": "feature"}]
        errors = validate_contract(CONTRACTS["add"], data)
        assert any("title" in e for e in errors)
        assert any("description" in e for e in errors)

    def test_add_valid_minimal_idea(self):
        data = [{"title": "Test", "description": "A test"}]
        errors = validate_contract(CONTRACTS["add"], data)
        assert errors == []

    def test_add_invalid_category(self):
        data = [{"title": "X", "description": "Y", "category": "INVALID"}]
        errors = validate_contract(CONTRACTS["add"], data)
        assert any("category" in e for e in errors)

    def test_add_invalid_priority(self):
        data = [{"title": "X", "description": "Y", "priority": "CRITICAL"}]
        errors = validate_contract(CONTRACTS["add"], data)
        assert any("priority" in e for e in errors)

    def test_update_requires_id(self):
        data = [{"status": "EXPLORING"}]
        errors = validate_contract(CONTRACTS["update"], data)
        assert any("id" in e for e in errors)

    def test_exploration_notes_appended(self, forge_env, project_name):
        """exploration_notes should be appended, not replaced."""
        _add_idea(project_name)
        cmd_update(_update_args(project_name, [
            {"id": "I-001", "exploration_notes": "First note"}
        ]))
        cmd_update(_update_args(project_name, [
            {"id": "I-001", "exploration_notes": "Second note"}
        ]))
        store = load_or_create(project_name)
        notes = store["ideas"][0]["exploration_notes"]
        assert "First note" in notes
        assert "Second note" in notes

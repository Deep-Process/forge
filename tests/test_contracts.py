"""Tests for core.contracts — validation foundation."""

import json
from pathlib import Path

import pytest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "core"))

from contracts import render_contract, validate_contract, atomic_write_json


# ---------------------------------------------------------------------------
# render_contract
# ---------------------------------------------------------------------------

class TestRenderContract:
    """Tests for the Markdown contract renderer."""

    def test_produces_valid_markdown_with_header(self):
        spec = {
            "required": ["name"],
            "optional": ["desc"],
            "enums": {},
        }
        md = render_contract("test-cmd", spec)
        assert "## test-cmd Contract" in md

    def test_field_table_contains_required_and_optional(self):
        spec = {
            "required": ["name", "type"],
            "optional": ["desc"],
            "enums": {"type": {"A", "B"}},
        }
        md = render_contract("example", spec)
        assert "| name |" in md
        assert "| type |" in md
        assert "| desc |" in md
        # Required fields marked YES
        lines = md.split("\n")
        name_line = [l for l in lines if "| name |" in l][0]
        assert "YES" in name_line
        desc_line = [l for l in lines if "| desc |" in l][0]
        assert "no" in desc_line

    def test_enum_values_rendered(self):
        spec = {
            "required": ["color"],
            "optional": [],
            "enums": {"color": {"red", "blue"}},
        }
        md = render_contract("enum-test", spec)
        assert "blue" in md
        assert "red" in md

    def test_type_labels_rendered(self):
        spec = {
            "required": ["items"],
            "optional": [],
            "enums": {},
            "types": {"items": list},
        }
        md = render_contract("type-test", spec)
        assert "array" in md

    def test_invariant_texts_rendered(self):
        spec = {
            "required": [],
            "optional": [],
            "enums": {},
            "invariant_texts": ["ID must be unique", "name is required"],
        }
        md = render_contract("inv-test", spec)
        assert "ID must be unique" in md
        assert "### Invariants" in md

    def test_output_format_always_present(self):
        spec = {"required": [], "optional": [], "enums": {}}
        md = render_contract("fmt-test", spec)
        assert "### Output Format" in md
        assert "raw JSON array" in md

    def test_example_rendered_as_json(self):
        spec = {
            "required": ["x"],
            "optional": [],
            "enums": {},
            "example": [{"x": "hello"}],
        }
        md = render_contract("ex-test", spec)
        assert "### Example" in md
        assert '"hello"' in md

    def test_notes_appended(self):
        spec = {
            "required": [],
            "optional": [],
            "enums": {},
            "notes": "Custom note here.",
        }
        md = render_contract("notes-test", spec)
        assert "Custom note here." in md


# ---------------------------------------------------------------------------
# validate_contract
# ---------------------------------------------------------------------------

class TestValidateContract:
    """Tests for contract validation."""

    def test_valid_data_passes(self):
        spec = {
            "required": ["name", "type"],
            "optional": ["desc"],
            "enums": {"type": {"A", "B"}},
        }
        data = [{"name": "foo", "type": "A"}]
        errors = validate_contract(spec, data)
        assert errors == []

    def test_not_a_list_rejected(self):
        spec = {"required": ["name"], "optional": [], "enums": {}}
        errors = validate_contract(spec, {"name": "foo"})
        assert len(errors) == 1
        assert "array" in errors[0].lower()

    def test_missing_required_field_detected(self):
        spec = {"required": ["name", "age"], "optional": [], "enums": {}}
        data = [{"name": "foo"}]
        errors = validate_contract(spec, data)
        assert any("age" in e for e in errors)

    def test_invalid_enum_detected(self):
        spec = {
            "required": ["status"],
            "optional": [],
            "enums": {"status": {"OPEN", "CLOSED"}},
        }
        data = [{"status": "INVALID"}]
        errors = validate_contract(spec, data)
        assert len(errors) == 1
        assert "INVALID" in errors[0]

    def test_valid_enum_passes(self):
        spec = {
            "required": ["status"],
            "optional": [],
            "enums": {"status": {"OPEN", "CLOSED"}},
        }
        data = [{"status": "OPEN"}]
        errors = validate_contract(spec, data)
        assert errors == []

    def test_type_validation(self):
        spec = {
            "required": ["items"],
            "optional": [],
            "enums": {},
            "types": {"items": list},
        }
        data = [{"items": "not-a-list"}]
        errors = validate_contract(spec, data)
        assert any("list" in e for e in errors)

    def test_type_validation_passes_for_correct_type(self):
        spec = {
            "required": ["items"],
            "optional": [],
            "enums": {},
            "types": {"items": list},
        }
        data = [{"items": ["a", "b"]}]
        errors = validate_contract(spec, data)
        assert errors == []

    def test_per_item_invariant(self):
        spec = {
            "required": ["value"],
            "optional": [],
            "enums": {},
            "invariants": [
                (lambda item, i: item.get("value", 0) > 0, "value must be positive"),
            ],
        }
        data = [{"value": -1}]
        errors = validate_contract(spec, data)
        assert any("positive" in e for e in errors)

    def test_array_invariant(self):
        spec = {
            "required": ["id"],
            "optional": [],
            "enums": {},
            "array_invariants": [
                (lambda data: len(data) <= 2, "max 2 items allowed"),
            ],
        }
        data = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        errors = validate_contract(spec, data)
        assert any("max 2" in e for e in errors)

    def test_null_enum_field(self):
        spec = {
            "required": ["status"],
            "optional": [],
            "enums": {"status": {"OPEN", "CLOSED"}},
        }
        data = [{"status": None}]
        errors = validate_contract(spec, data)
        assert any("null" in e.lower() for e in errors)

    def test_multiple_items_validated(self):
        spec = {
            "required": ["name"],
            "optional": [],
            "enums": {},
        }
        data = [{"name": "ok"}, {}, {"name": "also-ok"}]
        errors = validate_contract(spec, data)
        assert len(errors) == 1
        assert "[1]" in errors[0]

    def test_non_dict_item_rejected(self):
        spec = {"required": ["x"], "optional": [], "enums": {}}
        data = ["not-a-dict"]
        errors = validate_contract(spec, data)
        assert any("object" in e for e in errors)

    def test_empty_list_passes(self):
        spec = {"required": ["x"], "optional": [], "enums": {}}
        errors = validate_contract(spec, [])
        assert errors == []


# ---------------------------------------------------------------------------
# atomic_write_json
# ---------------------------------------------------------------------------

class TestAtomicWriteJson:
    """Tests for atomic JSON file writing."""

    def test_writes_valid_json(self, tmp_path):
        target = tmp_path / "output" / "data.json"
        data = {"key": "value", "number": 42}
        atomic_write_json(target, data)

        assert target.exists()
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded == data

    def test_creates_parent_directories(self, tmp_path):
        target = tmp_path / "deep" / "nested" / "dir" / "file.json"
        atomic_write_json(target, {"a": 1})
        assert target.exists()

    def test_overwrites_existing_file(self, tmp_path):
        target = tmp_path / "data.json"
        atomic_write_json(target, {"v": 1})
        atomic_write_json(target, {"v": 2})
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded["v"] == 2

    def test_unicode_content(self, tmp_path):
        target = tmp_path / "unicode.json"
        data = {"text": "zażółć gęślą jaźń"}
        atomic_write_json(target, data)
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded["text"] == "zażółć gęślą jaźń"


# ---------------------------------------------------------------------------
# Contract specs for each module
# ---------------------------------------------------------------------------

class TestModuleContractSpecs:
    """Verify contract specs from each module are well-formed and can be
    rendered and validated."""

    def _assert_spec_valid(self, spec):
        """Check a spec dict has required structure."""
        assert "required" in spec
        assert isinstance(spec["required"], list)
        assert isinstance(spec.get("optional", []), list)
        assert isinstance(spec.get("enums", {}), dict)
        # Renders without error
        md = render_contract("test", spec)
        assert len(md) > 0
        # Example validates if provided
        if "example" in spec:
            errors = validate_contract(spec, spec["example"])
            assert errors == [], f"Example fails validation: {errors}"

    def test_pipeline_add_tasks_contract(self):
        from pipeline import CONTRACTS
        self._assert_spec_valid(CONTRACTS["add-tasks"])

    def test_pipeline_update_task_contract(self):
        from pipeline import CONTRACTS
        self._assert_spec_valid(CONTRACTS["update-task"])

    def test_pipeline_register_subtasks_contract(self):
        from pipeline import CONTRACTS
        self._assert_spec_valid(CONTRACTS["register-subtasks"])

    def test_pipeline_config_contract(self):
        from pipeline import CONTRACTS
        self._assert_spec_valid(CONTRACTS["config"])

    def test_decisions_add_contract(self):
        from decisions import CONTRACTS
        self._assert_spec_valid(CONTRACTS["add"])

    def test_decisions_update_contract(self):
        from decisions import CONTRACTS
        self._assert_spec_valid(CONTRACTS["update"])

    def test_guidelines_add_contract(self):
        from guidelines import CONTRACTS
        self._assert_spec_valid(CONTRACTS["add"])

    def test_guidelines_update_contract(self):
        from guidelines import CONTRACTS
        self._assert_spec_valid(CONTRACTS["update"])

    def test_ideas_add_contract(self):
        from ideas import CONTRACTS
        self._assert_spec_valid(CONTRACTS["add"])

    def test_ideas_update_contract(self):
        from ideas import CONTRACTS
        self._assert_spec_valid(CONTRACTS["update"])

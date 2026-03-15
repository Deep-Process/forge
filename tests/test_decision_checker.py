"""Tests for core.decision_checker — decision drift detection."""
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def run_dc(*args: str) -> subprocess.CompletedProcess:
    """Run decision_checker as subprocess."""
    return subprocess.run(
        [sys.executable, "-m", "core.decision_checker", *args],
        capture_output=True, text=True, cwd=str(ROOT),
    )


class TestCLI:
    def test_help(self):
        r = run_dc("--help")
        assert r.returncode == 0
        assert "check" in r.stdout
        assert "report" in r.stdout

    def test_check_help(self):
        r = run_dc("check", "--help")
        assert r.returncode == 0
        assert "--task" in r.stdout

    def test_no_command(self):
        r = run_dc()
        assert r.returncode != 0


class TestImports:
    def test_module_imports(self):
        """Core functions are importable."""
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import (
            extract_keywords,
            file_matches,
            check_decision,
            detect_drift,
            load_locked_decisions,
            CHECKABLE_TYPES,
        )
        assert "architecture" in CHECKABLE_TYPES
        assert "exploration" not in CHECKABLE_TYPES

    def test_extract_keywords(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import extract_keywords

        kws = extract_keywords("Use RS256 for JWT signing")
        assert "rs256" in kws or "signing" in kws
        # Short words excluded
        assert "use" not in kws
        assert "for" not in kws

    def test_extract_keywords_empty(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import extract_keywords
        assert extract_keywords("") == set()
        assert extract_keywords(None) == set()

    def test_file_matches(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import file_matches

        assert file_matches("src/auth.ts", "src/auth.ts")
        assert file_matches("auth.ts", "src/auth.ts")
        assert file_matches("src/auth.ts", "auth.ts")
        assert not file_matches("auth.ts", "src/database.ts")
        assert not file_matches("", "src/auth.ts")

    def test_file_matches_backslash(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import file_matches

        assert file_matches("src\\auth.ts", "src/auth.ts")


class TestCheckDecision:
    def test_not_applicable_no_file_match(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import check_decision

        decision = {
            "id": "D-001",
            "type": "architecture",
            "issue": "JWT algorithm",
            "recommendation": "Use RS256",
            "alternatives": ["HS256"],
            "file": "src/auth.ts",
        }
        result = check_decision(decision, ["src/database.ts"], "some code")
        assert result["status"] == "NOT_APPLICABLE"

    def test_drift_major_alternative_found(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import check_decision

        decision = {
            "id": "D-001",
            "type": "architecture",
            "issue": "JWT algorithm",
            "recommendation": "Use RS256",
            "alternatives": ["Use HS256 symmetric signing"],
            "file": "auth.ts",
        }
        result = check_decision(
            decision,
            ["src/auth.ts"],
            "import hs256 from symmetric signing library",
        )
        assert result["status"] == "DRIFT_MAJOR"
        assert "HS256" in result["reasoning"] or "symmetric" in result["reasoning"]

    def test_compliant_recommendation_found(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import check_decision

        decision = {
            "id": "D-002",
            "type": "implementation",
            "issue": "Cache strategy",
            "recommendation": "Use Redis for caching layer",
            "alternatives": [],
            "file": "cache.py",
        }
        result = check_decision(
            decision,
            ["src/cache.py"],
            "import redis\nredis_client = Redis()",
        )
        assert result["status"] == "COMPLIANT"

    def test_drift_minor_no_keywords(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import check_decision

        decision = {
            "id": "D-003",
            "type": "convention",
            "issue": "Naming convention",
            "recommendation": "Use snake_case for Python files",
            "alternatives": [],
            "file": "utils.py",
        }
        result = check_decision(
            decision,
            ["src/utils.py"],
            "def doSomething(): pass",
        )
        assert result["status"] == "DRIFT_MINOR"

    def test_alternatives_as_dicts(self):
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import check_decision

        decision = {
            "id": "D-004",
            "type": "dependency",
            "issue": "Database choice",
            "recommendation": "Use PostgreSQL",
            "alternatives": [
                {"option": "Use SQLite for simplicity"},
                {"option": "Use MongoDB for flexibility"},
            ],
            "file": "database.py",
        }
        result = check_decision(
            decision,
            ["src/database.py"],
            "import sqlite3\nconn = sqlite3.connect('app.db')",
        )
        assert result["status"] == "DRIFT_MAJOR"


class TestDetectDrift:
    def test_no_decisions(self):
        """Project with no decisions returns NO_DECISIONS."""
        sys.path.insert(0, str(ROOT / "core"))
        from decision_checker import detect_drift

        # Use a nonexistent project — load_locked_decisions returns empty
        result = detect_drift("nonexistent-project-xyz", None)
        assert result["status"] == "NO_DECISIONS"
        assert result["decision_count"] == 0

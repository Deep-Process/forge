"""Tests for core.domain_modules — domain-specific guidance server."""
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
MODULES_DIR = ROOT / "skills" / "domain-modules" / "modules"


def run_dm(*args: str) -> subprocess.CompletedProcess:
    """Run domain_modules as subprocess."""
    return subprocess.run(
        [sys.executable, "-m", "core.domain_modules", *args],
        capture_output=True, text=True, cwd=str(ROOT),
    )


# -- list --

class TestList:
    def test_list_shows_all_modules(self):
        r = run_dm("list")
        assert r.returncode == 0
        for name in ("ux", "backend", "data", "process"):
            assert name in r.stdout

    def test_list_shows_phases(self):
        r = run_dm("list")
        assert "vision" in r.stdout
        assert "planning" in r.stdout


# -- get --

class TestGet:
    def test_get_valid_module_phase(self):
        r = run_dm("get", "ux", "--phase", "planning")
        assert r.returncode == 0
        assert "Decomposition Strategy" in r.stdout
        assert "component-centric" in r.stdout
        assert "Store output in" in r.stdout

    def test_get_includes_prerequisites(self):
        r = run_dm("get", "backend", "--phase", "vision")
        assert r.returncode == 0
        assert "Prerequisites" in r.stdout
        assert "MUST list files" in r.stdout

    def test_get_invalid_module(self):
        r = run_dm("get", "nonexistent", "--phase", "planning")
        assert r.returncode != 0
        assert "Unknown module" in r.stderr

    def test_get_invalid_phase(self):
        r = run_dm("get", "ux", "--phase", "nonexistent")
        assert r.returncode != 0
        assert "Unknown phase" in r.stderr


# -- for-scopes --

class TestForScopes:
    def test_single_scope_match(self):
        r = run_dm("for-scopes", "--scopes", "frontend", "--phase", "planning")
        assert r.returncode == 0
        assert "ux" in r.stdout.lower()
        assert "component-centric" in r.stdout

    def test_multiple_scope_match(self):
        r = run_dm("for-scopes", "--scopes", "frontend,backend", "--phase", "planning")
        assert r.returncode == 0
        assert "component-centric" in r.stdout  # UX
        assert "layer-centric" in r.stdout  # Backend
        assert "Cross-module" in r.stdout  # deps section

    def test_no_match(self):
        r = run_dm("for-scopes", "--scopes", "security", "--phase", "planning")
        assert r.returncode == 0
        assert "No domain modules match" in r.stdout

    def test_complexity_gate_bug(self):
        r = run_dm("for-scopes", "--scopes", "frontend", "--phase", "planning", "--task-type", "bug")
        assert r.returncode == 0
        assert "Skipped" in r.stdout
        assert "component-centric" not in r.stdout

    def test_complexity_gate_chore(self):
        r = run_dm("for-scopes", "--scopes", "frontend", "--phase", "planning", "--task-type", "chore")
        assert r.returncode == 0
        assert "Skipped" in r.stdout

    def test_complexity_gate_feature_loads(self):
        r = run_dm("for-scopes", "--scopes", "frontend", "--phase", "planning", "--task-type", "feature")
        assert r.returncode == 0
        assert "component-centric" in r.stdout

    def test_no_task_type_loads(self):
        """Without --task-type, modules should load (no gate)."""
        r = run_dm("for-scopes", "--scopes", "frontend", "--phase", "planning")
        assert r.returncode == 0
        assert "component-centric" in r.stdout


# -- deps --

class TestDeps:
    def test_deps_shows_interfaces(self):
        r = run_dm("deps", "ux", "backend")
        assert r.returncode == 0
        assert "Cross-module" in r.stdout
        assert "Provides" in r.stdout or "Needs" in r.stdout

    def test_deps_invalid_module(self):
        r = run_dm("deps", "nonexistent")
        assert r.returncode != 0


# -- parsing --

class TestParsing:
    @pytest.mark.parametrize("module", ["ux", "backend", "data", "process"])
    def test_all_modules_have_all_phases(self, module):
        """Each module file must have all 4 phases parseable."""
        for phase in ("vision", "research", "planning", "execution"):
            r = run_dm("get", module, "--phase", phase)
            assert r.returncode == 0, f"{module}/{phase} failed: {r.stderr}"
            assert f"Phase: {phase}" in r.stdout

    @pytest.mark.parametrize("module", ["ux", "backend", "data", "process"])
    def test_all_modules_have_cross_module(self, module):
        """Each module file must have Cross-module Interface section."""
        filepath = MODULES_DIR / f"{module}.md"
        content = filepath.read_text(encoding="utf-8")
        assert "## Cross-module Interface" in content

    def test_phase_content_is_compact(self):
        """Planning phase should be ~30-50 lines, not 175."""
        r = run_dm("get", "ux", "--phase", "planning")
        lines = r.stdout.strip().split("\n")
        # Prerequisites + header + phase content
        assert len(lines) < 60, f"UX planning phase too long: {len(lines)} lines"
        assert len(lines) > 15, f"UX planning phase too short: {len(lines)} lines"

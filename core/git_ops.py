"""
Git Operations — branch management and commit linking for Forge.

Structured git operations tied to the task pipeline:
- Branch per task or per project
- Commits tagged with task IDs for traceability
- Status showing git state relative to pipeline

All operations are optional — Forge works without git (with warnings).

Usage:
    python -m core.git_ops <command> [project] [options]

Commands:
    branch-create  {project} {task_id}                Create task branch
    commit         {project} {task_id} --message "..."  Commit with task metadata
    status                                             Show git state
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


# -- Helpers --

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git(*args_list) -> tuple:
    """Run a git command. Returns (success, stdout, stderr)."""
    try:
        result = subprocess.run(
            ["git"] + list(args_list),
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except FileNotFoundError:
        return False, "", "git not found"


def check_git():
    """Verify git is available and we're in a repo."""
    ok, _, _ = git("rev-parse", "--git-dir")
    if not ok:
        print("ERROR: Not a git repository or git not available.", file=sys.stderr)
        sys.exit(1)


def current_branch() -> str:
    ok, branch, _ = git("rev-parse", "--abbrev-ref", "HEAD")
    return branch if ok else "(unknown)"


def load_tracker(project: str) -> dict:
    path = Path("forge_output") / project / "tracker.json"
    if not path.exists():
        print(f"ERROR: No tracker for project '{project}'.", file=sys.stderr)
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def get_branch_prefix(tracker: dict) -> str:
    return tracker.get("config", {}).get("branch_prefix", "forge/")


# -- Commands --

def cmd_branch_create(args):
    """Create a branch for a task."""
    check_git()
    tracker = load_tracker(args.project)

    # Find task to use its name
    task_name = args.task_id
    for task in tracker.get("tasks", []):
        if task["id"] == args.task_id:
            task_name = task.get("name", args.task_id)
            break

    prefix = get_branch_prefix(tracker)
    branch_name = f"{prefix}{args.project}/{task_name}"

    # Check if branch already exists
    ok, existing, _ = git("branch", "--list", branch_name)
    if existing.strip():
        print(f"Branch already exists: {branch_name}")
        print(f"Switching to it...")
        ok, _, err = git("checkout", branch_name)
        if not ok:
            print(f"ERROR: {err}", file=sys.stderr)
            sys.exit(1)
        print(f"On branch: {branch_name}")
        return

    # Check for uncommitted changes
    ok, status_out, _ = git("status", "--porcelain")
    if status_out:
        print(f"WARNING: You have uncommitted changes ({len(status_out.splitlines())} files).")
        print(f"Creating branch anyway (changes will carry over).")

    # Create and switch
    base = args.base or current_branch()
    ok, _, err = git("checkout", "-b", branch_name, base)
    if not ok:
        print(f"ERROR creating branch: {err}", file=sys.stderr)
        sys.exit(1)

    print(f"Branch created: {branch_name}")
    print(f"  Base: {base}")
    print(f"  Task: {args.task_id}")
    print(f"  Project: {args.project}")


def cmd_commit(args):
    """Commit with task metadata in the message."""
    check_git()

    # Check for staged changes
    ok, staged, _ = git("diff", "--cached", "--stat")
    if not staged:
        # Auto-stage tracked files
        ok, status_out, _ = git("status", "--porcelain")
        if not status_out:
            print("Nothing to commit.")
            return
        print(f"No staged changes. Staging tracked modified files...")
        git("add", "-u")
        ok, staged, _ = git("diff", "--cached", "--stat")
        if not staged:
            print("Nothing to commit (only untracked files?).")
            return

    # Build commit message with task metadata
    message = f"[{args.task_id}] {args.message}"
    body = f"\nForge-Project: {args.project}\nForge-Task: {args.task_id}\n"

    full_message = f"{message}\n{body}"

    ok, out, err = git("commit", "-m", full_message)
    if not ok:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)

    print(f"Committed: [{args.task_id}] {args.message}")
    # Show short stat
    ok, log, _ = git("log", "--oneline", "-1", "--stat")
    if ok:
        for line in log.split("\n")[1:]:
            print(f"  {line}")


def cmd_status(args):
    """Show git state."""
    check_git()

    branch = current_branch()
    ok, status_out, _ = git("status", "--porcelain")
    ok, log, _ = git("log", "--oneline", "-5")

    print(f"## Git Status")
    print()
    print(f"Branch: {branch}")

    if status_out:
        lines = status_out.strip().split("\n")
        modified = sum(1 for l in lines if l.startswith(" M") or l.startswith("M "))
        added = sum(1 for l in lines if l.startswith("A ") or l.startswith("??"))
        deleted = sum(1 for l in lines if l.startswith(" D") or l.startswith("D "))
        staged = sum(1 for l in lines if l[0] != " " and l[0] != "?")
        print(f"Working tree: {len(lines)} changes ({modified} modified, {added} added, {deleted} deleted)")
        if staged:
            print(f"Staged: {staged} files")
    else:
        print(f"Working tree: clean")

    print()
    print(f"Recent commits:")
    if log:
        for line in log.split("\n"):
            print(f"  {line}")


# -- CLI --

def main():
    parser = argparse.ArgumentParser(description="Forge Git Ops -- git integration")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("branch-create", help="Create task branch")
    p.add_argument("project")
    p.add_argument("task_id")
    p.add_argument("--base", default=None, help="Base branch (default: current)")

    p = sub.add_parser("commit", help="Commit with task metadata")
    p.add_argument("project")
    p.add_argument("task_id")
    p.add_argument("--message", "-m", required=True, help="Commit message")

    sub.add_parser("status", help="Show git state")

    args = parser.parse_args()

    commands = {
        "branch-create": cmd_branch_create,
        "commit": cmd_commit,
        "status": cmd_status,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

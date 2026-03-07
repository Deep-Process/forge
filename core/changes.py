"""
Changes — track every code modification with full context.

This is NEW — Skill_v1 didn't have this because it tracked field resolutions,
not code changes. This module fills the gap between git (WHAT changed) and
decisions (WHY we chose this approach) by recording the actual execution context.

Every change record captures:
- WHAT file was modified and how (create/edit/delete)
- WHY this change was made (linked to task + decision)
- HOW the agent reasoned about it (reasoning_trace)
- WHO made or approved it (claude/user)

Usage:
    python -m core.changes <command> <project> [options]

Commands:
    record   {project} --data '{json}'    Record changes
    read     {project} [--task X]         Read change log
    summary  {project}                    Summary statistics
    contract                              Print contract spec
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contracts import render_contract, validate_contract

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


# -- Paths --

def changes_path(project: str) -> Path:
    return Path("forge_output") / project / "changes.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_or_create(project: str) -> dict:
    path = changes_path(project)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "project": project,
        "updated": now_iso(),
        "changes": [],
    }


def save_json(project: str, data: dict):
    path = changes_path(project)
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updated"] = now_iso()
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# -- Contract --

CONTRACTS = {
    "record": {
        "required": ["task_id", "file", "action", "summary"],
        "optional": ["reasoning_trace", "decision_ids", "lines_added",
                      "lines_removed", "group_id"],
        "enums": {
            "action": {"create", "edit", "delete", "rename", "move"},
        },
        "types": {
            "reasoning_trace": list,
            "decision_ids": list,
            "lines_added": int,
            "lines_removed": int,
        },
        "invariant_texts": [
            "task_id must reference an existing task in the pipeline",
            "file must be a relative path from project root",
            "reasoning_trace: array of {step, detail} objects explaining the change",
            "decision_ids: list of D-NNN IDs that led to this change",
            "group_id: links related changes across files (e.g. a refactor touching 5 files)",
        ],
        "example": [
            {
                "task_id": "T-003",
                "file": "src/middleware/auth.ts",
                "action": "create",
                "summary": "JWT validation middleware with RS256 support",
                "reasoning_trace": [
                    {"step": "design", "detail": "Chose middleware pattern over per-route guards for DRY"},
                    {"step": "implementation", "detail": "Used jsonwebtoken library, RS256 algorithm per D-001"},
                    {"step": "security", "detail": "Added token expiry check, audience validation"},
                ],
                "decision_ids": ["D-001"],
                "lines_added": 45,
            },
            {
                "task_id": "T-003",
                "file": "src/routes/api.ts",
                "action": "edit",
                "summary": "Added auth middleware to protected routes",
                "reasoning_trace": [
                    {"step": "integration", "detail": "Applied middleware to /api/* routes, excluded /api/health"},
                ],
                "decision_ids": ["D-001"],
                "group_id": "auth-middleware-integration",
                "lines_added": 3,
                "lines_removed": 1,
            },
        ],
    },
}


# -- Commands --

def cmd_record(args):
    """Record change entries."""
    try:
        new_changes = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(new_changes, list):
        print("ERROR: --data must be a JSON array", file=sys.stderr)
        sys.exit(1)

    errors = validate_contract(CONTRACTS["record"], new_changes)
    if errors:
        print(f"ERROR: {len(errors)} validation issues:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    data = load_or_create(args.project)
    timestamp = now_iso()

    # Find next C-NNN ID
    existing_ids = [
        int(c["id"].split("-")[1]) for c in data.get("changes", [])
        if c.get("id", "").startswith("C-")
    ]
    next_id = max(existing_ids, default=0) + 1

    recorded = []
    for c in new_changes:
        change = {
            "id": f"C-{next_id:03d}",
            "task_id": c["task_id"],
            "file": c["file"],
            "action": c["action"],
            "summary": c["summary"],
            "reasoning_trace": c.get("reasoning_trace", []),
            "decision_ids": c.get("decision_ids", []),
            "lines_added": c.get("lines_added", 0),
            "lines_removed": c.get("lines_removed", 0),
            "group_id": c.get("group_id", ""),
            "timestamp": timestamp,
        }
        data["changes"].append(change)
        recorded.append(change["id"])
        next_id += 1

    save_json(args.project, data)

    print(f"Changes recorded: {args.project}")
    print(f"  Added: {len(recorded)} ({', '.join(recorded)})")
    print(f"  Total: {len(data['changes'])}")


def cmd_read(args):
    """Read change log."""
    path = changes_path(args.project)
    if not path.exists():
        print(f"No changes recorded for '{args.project}' yet.")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    changes = data.get("changes", [])

    if args.task:
        changes = [c for c in changes if c.get("task_id") == args.task]

    print(f"## Changes: {args.project}")
    if args.task:
        print(f"Filter: task={args.task}")
    print(f"Count: {len(changes)}")
    print()

    if not changes:
        print("(none)")
        return

    print("| ID | Task | File | Action | Summary | Decisions |")
    print("|----|------|------|--------|---------|-----------|")
    for c in changes:
        summary = c.get("summary", "")[:40]
        decs = ", ".join(c.get("decision_ids", [])) or "--"
        print(f"| {c['id']} | {c['task_id']} | {c['file']} | {c['action']} | {summary} | {decs} |")


def cmd_summary(args):
    """Summary statistics."""
    path = changes_path(args.project)
    if not path.exists():
        print(f"No changes recorded for '{args.project}' yet.")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    changes = data.get("changes", [])

    # Stats
    by_action = {}
    by_task = {}
    total_added = 0
    total_removed = 0
    files_touched = set()

    for c in changes:
        action = c.get("action", "unknown")
        by_action[action] = by_action.get(action, 0) + 1
        task = c.get("task_id", "unknown")
        by_task[task] = by_task.get(task, 0) + 1
        total_added += c.get("lines_added", 0)
        total_removed += c.get("lines_removed", 0)
        files_touched.add(c.get("file", ""))

    print(f"## Change Summary: {args.project}")
    print()
    print(f"| Metric | Value |")
    print(f"|--------|-------|")
    print(f"| Total changes | {len(changes)} |")
    print(f"| Files touched | {len(files_touched)} |")
    print(f"| Lines added | {total_added} |")
    print(f"| Lines removed | {total_removed} |")
    print()
    print("### By action")
    for action, count in sorted(by_action.items()):
        print(f"  {action}: {count}")
    print()
    print("### By task")
    for task, count in sorted(by_task.items()):
        print(f"  {task}: {count}")


def cmd_contract(args):
    """Print contract spec."""
    print(render_contract("record", CONTRACTS["record"]))


# -- CLI --

def main():
    parser = argparse.ArgumentParser(description="Forge Changes -- change tracking with context")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("record", help="Record changes")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("read", help="Read change log")
    p.add_argument("project")
    p.add_argument("--task", help="Filter by task_id")

    p = sub.add_parser("summary", help="Summary statistics")
    p.add_argument("project")

    sub.add_parser("contract", help="Print contract spec")

    args = parser.parse_args()

    commands = {
        "record": cmd_record,
        "read": cmd_read,
        "summary": cmd_summary,
        "contract": cmd_contract,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

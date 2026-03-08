"""
Ideas — staging area for proposals, plans, and directions before execution.

Ideas are the layer BETWEEN "I have a thought" and "let's build it".
They provide a space to explore, assess risks, design architecture,
and mature a proposal before committing it to the task pipeline.

Lifecycle:
    DRAFT → EXPLORING → ACCEPTED → COMMITTED
                      ↘ REJECTED (with reason)

- DRAFT: initial capture, not yet analyzed
- EXPLORING: deep-* analysis in progress (discover, risk, feasibility, etc.)
- ACCEPTED: approved for implementation, ready to become tasks
- REJECTED: discarded (with reason, or merged_into another idea)
- COMMITTED: transformed into task graph via /plan (terminal state)

Decisions created during exploration reference the idea via task_id: "I-NNN".
When committed, tasks in the pipeline carry origin: "I-NNN" for traceability.

Usage:
    python -m core.ideas <command> <project> [options]

Commands:
    add      {project} --data '{json}'         Add ideas
    read     {project} [--status X] [--category X]  Read ideas
    update   {project} --data '{json}'         Update idea fields/status
    show     {project} {idea_id}               Show full idea details
    commit   {project} {idea_id}               Mark ACCEPTED idea as COMMITTED
    contract {name}                            Print contract spec
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Import contracts from sibling module
sys.path.insert(0, str(Path(__file__).resolve().parent))
from contracts import render_contract, validate_contract, atomic_write_json

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


# -- Paths --

def ideas_path(project: str) -> Path:
    return Path("forge_output") / project / "ideas.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_or_create(project: str) -> dict:
    path = ideas_path(project)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "project": project,
        "updated": now_iso(),
        "ideas": [],
    }


def save_json(project: str, data: dict):
    path = ideas_path(project)
    data["updated"] = now_iso()
    atomic_write_json(path, data)


def find_idea(data: dict, idea_id: str) -> dict:
    """Find idea by ID. Exits with error if not found."""
    for idea in data.get("ideas", []):
        if idea["id"] == idea_id:
            return idea
    print(f"ERROR: Idea '{idea_id}' not found.", file=sys.stderr)
    sys.exit(1)


# -- Contracts --

CONTRACTS = {
    "add": {
        "required": ["title", "description"],
        "optional": ["category", "priority", "tags", "related_ideas",
                      "guidelines"],
        "enums": {
            "category": {"feature", "improvement", "experiment",
                         "migration", "refactor", "infrastructure"},
            "priority": {"HIGH", "MEDIUM", "LOW"},
        },
        "types": {
            "tags": list,
            "related_ideas": list,
            "guidelines": list,
        },
        "invariant_texts": [
            "title: concise name for the idea (e.g., 'Add Redis caching to API')",
            "description: what you want to achieve and why — enough for exploration to begin",
            "category: what kind of work this is (feature, improvement, experiment, migration, refactor, infrastructure)",
            "priority: HIGH (urgent/blocking), MEDIUM (planned), LOW (nice-to-have)",
            "tags: searchable keywords",
            "related_ideas: list of idea IDs this relates to (e.g., ['I-001', 'I-003'])",
            "guidelines: list of guideline IDs that apply to this idea (e.g., ['G-001'])",
        ],
        "example": [
            {
                "title": "Add Redis caching to API",
                "description": "API response times are slow for repeated queries. Add a caching layer with Redis to reduce DB load and improve p95 latency.",
                "category": "improvement",
                "priority": "HIGH",
                "tags": ["performance", "caching", "redis"],
            },
            {
                "title": "Migrate from REST to GraphQL",
                "description": "Frontend makes too many roundtrips. GraphQL would allow batching and field selection.",
                "category": "migration",
                "priority": "MEDIUM",
                "related_ideas": ["I-001"],
            },
        ],
    },
    "update": {
        "required": ["id"],
        "optional": ["title", "description", "status", "category",
                      "priority", "rejection_reason", "merged_into",
                      "tags", "related_ideas", "guidelines",
                      "exploration_notes"],
        "enums": {
            "status": {"DRAFT", "EXPLORING", "ACCEPTED", "REJECTED"},
            "category": {"feature", "improvement", "experiment",
                         "migration", "refactor", "infrastructure"},
            "priority": {"HIGH", "MEDIUM", "LOW"},
        },
        "types": {
            "tags": list,
            "related_ideas": list,
            "guidelines": list,
        },
        "invariant_texts": [
            "id: existing idea ID (I-001, etc.)",
            "Only provided fields are updated — omitted fields stay unchanged",
            "status transitions: DRAFT→EXPLORING, EXPLORING→ACCEPTED, EXPLORING→REJECTED, DRAFT→REJECTED",
            "REJECTED: set rejection_reason explaining why",
            "REJECTED+merged_into: idea absorbed by another (e.g., merged_into='I-005')",
            "COMMITTED status is set only by the `commit` command, not by update",
            "exploration_notes: free-text notes from analysis (appended, not replaced)",
        ],
        "example": [
            {"id": "I-001", "status": "EXPLORING"},
            {"id": "I-002", "status": "REJECTED",
             "rejection_reason": "Too risky for current phase, revisit in Q3"},
            {"id": "I-003", "status": "ACCEPTED",
             "exploration_notes": "Feasibility: GO. Risk: LOW. Architecture: event-driven with Redis pub/sub."},
        ],
    },
}

# Valid status transitions (via cmd_update only).
# ACCEPTED → COMMITTED is handled by cmd_commit, not update.
VALID_TRANSITIONS = {
    "DRAFT": {"EXPLORING", "REJECTED"},
    "EXPLORING": {"ACCEPTED", "REJECTED", "DRAFT"},  # DRAFT allows "back to drawing board"
    "ACCEPTED": {"REJECTED"},  # can still reject before commit
    "REJECTED": {"DRAFT"},  # can reopen
    "COMMITTED": set(),  # terminal — no transitions allowed
}


# -- Commands --

def cmd_add(args):
    """Add ideas to the staging area."""
    try:
        new_ideas = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(new_ideas, list):
        print("ERROR: --data must be a JSON array", file=sys.stderr)
        sys.exit(1)

    errors = validate_contract(CONTRACTS["add"], new_ideas)
    if errors:
        print(f"ERROR: {len(errors)} validation issues:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    data = load_or_create(args.project)
    timestamp = now_iso()

    # Find next I-NNN ID
    existing_ids = [
        int(i["id"].split("-")[1]) for i in data.get("ideas", [])
        if i.get("id", "").startswith("I-")
    ]
    next_id = max(existing_ids, default=0) + 1

    added = []
    for item in new_ideas:
        idea = {
            "id": f"I-{next_id:03d}",
            "title": item["title"],
            "description": item["description"],
            "category": item.get("category", "feature"),
            "priority": item.get("priority", "MEDIUM"),
            "tags": item.get("tags", []),
            "related_ideas": item.get("related_ideas", []),
            "guidelines": item.get("guidelines", []),
            "status": "DRAFT",
            "rejection_reason": "",
            "merged_into": "",
            "exploration_notes": "",
            "committed_at": None,
            "created": timestamp,
            "updated": timestamp,
        }

        data["ideas"].append(idea)
        added.append(idea["id"])
        next_id += 1

    save_json(args.project, data)

    status_counts = _status_counts(data)
    print(f"Ideas saved: {args.project}")
    print(f"  Added: {len(added)} ({', '.join(added)})")
    print(f"  Total: {len(data['ideas'])} | {_format_counts(status_counts)}")


def cmd_read(args):
    """Read ideas (optionally filtered)."""
    path = ideas_path(args.project)
    if not path.exists():
        print(f"No ideas for '{args.project}' yet.")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    ideas = data.get("ideas", [])

    # Filter
    if args.status:
        ideas = [i for i in ideas if i.get("status") == args.status]
    if args.category:
        ideas = [i for i in ideas if i.get("category") == args.category]

    # Sort by ID
    ideas.sort(key=lambda i: i.get("id", ""))

    # Render
    print(f"## Ideas: {args.project}")
    filters = []
    if args.status:
        filters.append(f"status={args.status}")
    if args.category:
        filters.append(f"category={args.category}")
    if filters:
        print(f"Filter: {', '.join(filters)}")
    print(f"Count: {len(ideas)}")
    print()

    if not ideas:
        print("(none)")
        return

    print("| ID | Category | Priority | Title | Status |")
    print("|----|----------|----------|-------|--------|")
    for i in ideas:
        title = i.get("title", "")[:45]
        status = i.get("status", "")
        if status == "REJECTED" and i.get("merged_into"):
            status = f"MERGED→{i['merged_into']}"
        print(f"| {i['id']} | {i.get('category', '')} | {i.get('priority', '')} | {title} | {status} |")


def cmd_show(args):
    """Show full details for a single idea."""
    path = ideas_path(args.project)
    if not path.exists():
        print(f"No ideas for '{args.project}' yet.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text(encoding="utf-8"))
    idea = find_idea(data, args.idea_id)

    print(f"## Idea {idea['id']}: {idea['title']}")
    print()
    print(f"- **Status**: {idea['status']}")
    print(f"- **Category**: {idea.get('category', '')}")
    print(f"- **Priority**: {idea.get('priority', '')}")
    print(f"- **Created**: {idea.get('created', '')}")
    print(f"- **Updated**: {idea.get('updated', '')}")
    if idea.get("tags"):
        print(f"- **Tags**: {', '.join(idea['tags'])}")
    if idea.get("related_ideas"):
        print(f"- **Related**: {', '.join(idea['related_ideas'])}")
    if idea.get("guidelines"):
        print(f"- **Guidelines**: {', '.join(idea['guidelines'])}")
    print()

    print("### Description")
    print(idea.get("description", ""))
    print()

    if idea.get("exploration_notes"):
        print("### Exploration Notes")
        print(idea["exploration_notes"])
        print()

    if idea.get("rejection_reason"):
        print("### Rejection Reason")
        print(idea["rejection_reason"])
        print()

    if idea.get("merged_into"):
        print(f"**Merged into**: {idea['merged_into']}")
        print()

    if idea.get("committed_at"):
        print(f"**Committed at**: {idea['committed_at']}")
        print()

    # Show related decisions (task_id = idea ID)
    decisions_file = Path("forge_output") / args.project / "decisions.json"
    if decisions_file.exists():
        dec_data = json.loads(decisions_file.read_text(encoding="utf-8"))
        related_decisions = [d for d in dec_data.get("decisions", [])
                             if d.get("task_id") == idea["id"]]
        if related_decisions:
            print(f"### Related Decisions ({len(related_decisions)})")
            print()
            for d in related_decisions:
                print(f"- **{d['id']}** ({d.get('status', '')}): {d.get('issue', '')}")
                if d.get("recommendation"):
                    print(f"  → {d['recommendation']}")
            print()

    # Next steps hint
    if idea["status"] == "DRAFT":
        print("**Next**: `/explore {id}` or `/discover {id}` to analyze this idea")
    elif idea["status"] == "EXPLORING":
        print("**Next**: Update to ACCEPTED when analysis is complete, or REJECTED if not viable")
    elif idea["status"] == "ACCEPTED":
        print(f"**Next**: `/plan {idea['id']}` to create task graph from this idea")


def cmd_update(args):
    """Update idea fields and status."""
    try:
        updates = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(updates, list):
        updates = [updates]

    errors = validate_contract(CONTRACTS["update"], updates)
    if errors:
        print(f"ERROR: {len(errors)} validation issues:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    data = load_or_create(args.project)
    timestamp = now_iso()

    updated = []
    for u in updates:
        idea = None
        for i in data.get("ideas", []):
            if i["id"] == u["id"]:
                idea = i
                break
        if idea is None:
            print(f"  WARNING: Idea {u['id']} not found, skipping", file=sys.stderr)
            continue

        # Validate status transition
        if "status" in u:
            new_status = u["status"]
            current = idea["status"]
            if current == "COMMITTED":
                print(f"  ERROR: Idea {u['id']} is COMMITTED (terminal state), cannot change status", file=sys.stderr)
                continue
            if new_status not in VALID_TRANSITIONS.get(current, set()):
                print(f"  WARNING: Invalid transition {current}→{new_status} for {u['id']}. "
                      f"Valid: {', '.join(sorted(VALID_TRANSITIONS.get(current, set()))) or 'none'}",
                      file=sys.stderr)
                continue

        # Apply updates
        updatable = ["title", "description", "status", "category", "priority",
                     "rejection_reason", "merged_into", "tags", "related_ideas",
                     "guidelines"]
        for field in updatable:
            if field in u:
                idea[field] = u[field]

        # exploration_notes: append, not replace
        if "exploration_notes" in u:
            existing = idea.get("exploration_notes", "")
            separator = "\n\n---\n\n" if existing else ""
            idea["exploration_notes"] = existing + separator + u["exploration_notes"]

        idea["updated"] = timestamp
        updated.append(u["id"])

    save_json(args.project, data)

    status_counts = _status_counts(data)
    print(f"Updated {len(updated)} ideas: {args.project}")
    for idea_id in updated:
        idea = next(i for i in data["ideas"] if i["id"] == idea_id)
        print(f"  {idea_id}: {idea.get('title', '')[:40]} ({idea.get('status', '')})")
    print(f"  {_format_counts(status_counts)}")


def cmd_commit(args):
    """Mark an ACCEPTED idea as COMMITTED — ready for /plan."""
    data = load_or_create(args.project)
    idea = find_idea(data, args.idea_id)

    if idea["status"] != "ACCEPTED":
        print(f"ERROR: Idea {args.idea_id} must be ACCEPTED before commit (is {idea['status']}).",
              file=sys.stderr)
        if idea["status"] == "DRAFT":
            print("  Explore it first: /discover {id} or update to EXPLORING", file=sys.stderr)
        elif idea["status"] == "EXPLORING":
            print("  Analysis still in progress. Update to ACCEPTED when ready.", file=sys.stderr)
        sys.exit(1)

    idea["status"] = "COMMITTED"
    idea["committed_at"] = now_iso()
    idea["updated"] = now_iso()

    save_json(args.project, data)

    # Present context for /plan
    print(f"## Idea {idea['id']} committed: {idea['title']}")
    print()
    print(f"**Category**: {idea.get('category', '')}")
    print(f"**Priority**: {idea.get('priority', '')}")
    print()
    print("### Description")
    print(idea.get("description", ""))
    print()

    if idea.get("exploration_notes"):
        print("### Exploration Summary")
        print(idea["exploration_notes"])
        print()

    if idea.get("guidelines"):
        print(f"### Linked Guidelines: {', '.join(idea['guidelines'])}")
        print()

    # Show related decisions
    decisions_file = Path("forge_output") / args.project / "decisions.json"
    if decisions_file.exists():
        dec_data = json.loads(decisions_file.read_text(encoding="utf-8"))
        related = [d for d in dec_data.get("decisions", [])
                   if d.get("task_id") == idea["id"]]
        open_decisions = [d for d in related if d.get("status") == "OPEN"]
        closed_decisions = [d for d in related if d.get("status") == "CLOSED"]

        if open_decisions:
            print(f"### Open Decisions ({len(open_decisions)}) — resolve before /plan")
            for d in open_decisions:
                print(f"- **{d['id']}**: {d.get('issue', '')}")
            print()

        if closed_decisions:
            print(f"### Resolved Decisions ({len(closed_decisions)})")
            for d in closed_decisions:
                rec = d.get("recommendation", "")
                override = d.get("override_value", "")
                value = override if override else rec
                print(f"- **{d['id']}**: {d.get('issue', '')} → {value}")
            print()

    print("### Next Step")
    print(f"Run `/plan {idea['id']}` to create task graph.")
    print(f"Tasks will carry `origin: \"{idea['id']}\"` for traceability.")


def cmd_contract(args):
    """Print contract spec for a command."""
    if args.name not in CONTRACTS:
        print(f"ERROR: Unknown contract '{args.name}'", file=sys.stderr)
        print(f"Available: {', '.join(sorted(CONTRACTS.keys()))}", file=sys.stderr)
        sys.exit(1)
    print(render_contract(args.name, CONTRACTS[args.name]))


# -- Helpers --

def _status_counts(data: dict) -> dict:
    counts = {}
    for i in data.get("ideas", []):
        s = i.get("status", "DRAFT")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _format_counts(counts: dict) -> str:
    parts = []
    for status in ["DRAFT", "EXPLORING", "ACCEPTED", "REJECTED", "COMMITTED"]:
        if counts.get(status, 0) > 0:
            parts.append(f"{status}: {counts[status]}")
    return " | ".join(parts) if parts else "empty"


# -- CLI --

def main():
    parser = argparse.ArgumentParser(description="Forge Ideas -- staging area for proposals and plans")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("add", help="Add ideas")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("read", help="Read ideas")
    p.add_argument("project")
    p.add_argument("--status", help="Filter by status")
    p.add_argument("--category", help="Filter by category")

    p = sub.add_parser("show", help="Show full idea details")
    p.add_argument("project")
    p.add_argument("idea_id")

    p = sub.add_parser("update", help="Update ideas")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("commit", help="Mark ACCEPTED idea as COMMITTED")
    p.add_argument("project")
    p.add_argument("idea_id")

    p = sub.add_parser("contract", help="Print contract spec")
    p.add_argument("name", choices=sorted(CONTRACTS.keys()))

    args = parser.parse_args()

    commands = {
        "add": cmd_add,
        "read": cmd_read,
        "show": cmd_show,
        "update": cmd_update,
        "commit": cmd_commit,
        "contract": cmd_contract,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

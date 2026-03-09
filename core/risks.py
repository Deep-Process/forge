"""
Risks — identification, tracking, and mitigation of project risks.

A Risk is a distinct entity with its own lifecycle, separate from Decisions.
Decisions record choices made. Risks record things that could go wrong
and how they are being managed.

Lifecycle:
    OPEN → ANALYZING → MITIGATED / ACCEPTED / CLOSED
                      ↘ back to OPEN if risk resurfaces

Risks link to ideas (during exploration) or tasks (during execution).

Usage:
    python -m core.risks <command> <project> [options]

Commands:
    add      {project} --data '{json}'          Add risks
    read     {project} [--status X] [--entity X]  Read risks
    update   {project} --data '{json}'          Update risk status/fields
    show     {project} {risk_id}                Show full details
    contract {name}                             Print contract spec
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contracts import render_contract, validate_contract, atomic_write_json

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


# -- Paths --

def risks_path(project: str) -> Path:
    return Path("forge_output") / project / "risks.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_or_create(project: str) -> dict:
    path = risks_path(project)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "project": project,
        "updated": now_iso(),
        "risks": [],
    }


def save_json(project: str, data: dict):
    path = risks_path(project)
    data["updated"] = now_iso()
    atomic_write_json(path, data)


def find_risk(data: dict, risk_id: str) -> dict:
    """Find risk by ID. Exits with error if not found."""
    for risk in data.get("risks", []):
        if risk["id"] == risk_id:
            return risk
    print(f"ERROR: Risk '{risk_id}' not found.", file=sys.stderr)
    sys.exit(1)


# -- Contracts --

CONTRACTS = {
    "add": {
        "required": ["title", "description", "linked_entity_type",
                      "linked_entity_id", "severity", "likelihood"],
        "optional": ["mitigation_plan", "resolution_notes", "tags"],
        "enums": {
            "linked_entity_type": {"idea", "task"},
            "severity": {"HIGH", "MEDIUM", "LOW"},
            "likelihood": {"HIGH", "MEDIUM", "LOW"},
        },
        "types": {
            "tags": list,
        },
        "invariant_texts": [
            "title: concise risk name (e.g., 'Data loss during migration')",
            "description: detailed description of what could go wrong and impact",
            "linked_entity_type: 'idea' for exploration-phase risks, 'task' for execution-phase",
            "linked_entity_id: ID of linked entity (I-NNN for ideas, T-NNN for tasks)",
            "severity: HIGH (project-threatening), MEDIUM (significant impact), LOW (minor impact)",
            "likelihood: HIGH (probable), MEDIUM (possible), LOW (unlikely)",
            "mitigation_plan: how to reduce or eliminate the risk",
            "resolution_notes: how the risk was actually resolved (filled when closing)",
            "tags: searchable keywords",
        ],
        "example": [
            {
                "title": "Redis cluster failure causes cache stampede",
                "description": "If Redis goes down, all requests hit the database simultaneously, potentially causing cascading failure.",
                "linked_entity_type": "idea",
                "linked_entity_id": "I-001",
                "severity": "HIGH",
                "likelihood": "MEDIUM",
                "mitigation_plan": "Implement circuit breaker pattern with local fallback cache",
                "tags": ["redis", "availability", "cascading-failure"],
            },
        ],
    },
    "update": {
        "required": ["id"],
        "optional": ["status", "severity", "likelihood", "mitigation_plan",
                      "resolution_notes", "title", "description", "tags"],
        "enums": {
            "status": {"OPEN", "ANALYZING", "MITIGATED", "ACCEPTED", "CLOSED"},
            "severity": {"HIGH", "MEDIUM", "LOW"},
            "likelihood": {"HIGH", "MEDIUM", "LOW"},
        },
        "types": {
            "tags": list,
        },
        "invariant_texts": [
            "id: existing risk ID (R-NNN)",
            "Only provided fields are updated — omitted fields stay unchanged",
            "status transitions: OPEN→ANALYZING, ANALYZING→MITIGATED/ACCEPTED/CLOSED, MITIGATED→CLOSED/OPEN, ACCEPTED→CLOSED/OPEN, CLOSED→OPEN",
            "When setting MITIGATED: mitigation_plan should describe what was done",
            "When setting CLOSED: resolution_notes should explain the outcome",
            "When setting ACCEPTED: resolution_notes should explain why risk is accepted",
        ],
        "example": [
            {"id": "R-001", "status": "ANALYZING"},
            {"id": "R-002", "status": "MITIGATED",
             "mitigation_plan": "Implemented circuit breaker with 30s timeout and local LRU cache as fallback"},
            {"id": "R-003", "status": "ACCEPTED",
             "resolution_notes": "Risk accepted — low likelihood, monitoring in place"},
        ],
    },
}

VALID_TRANSITIONS = {
    "OPEN": {"ANALYZING", "ACCEPTED", "CLOSED"},
    "ANALYZING": {"MITIGATED", "ACCEPTED", "CLOSED", "OPEN"},
    "MITIGATED": {"CLOSED", "OPEN"},
    "ACCEPTED": {"CLOSED", "OPEN"},
    "CLOSED": {"OPEN"},
}


# -- Commands --

def cmd_add(args):
    """Add risks."""
    try:
        new_risks = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(new_risks, list):
        print("ERROR: --data must be a JSON array", file=sys.stderr)
        sys.exit(1)

    errors = validate_contract(CONTRACTS["add"], new_risks)
    if errors:
        print(f"ERROR: {len(errors)} validation issues:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    # Cross-validate linked entity exists
    for item in new_risks:
        entity_type = item["linked_entity_type"]
        entity_id = item["linked_entity_id"]
        if entity_type == "idea":
            ideas_file = Path("forge_output") / args.project / "ideas.json"
            if ideas_file.exists():
                ideas_data = json.loads(ideas_file.read_text(encoding="utf-8"))
                idea_ids = {i["id"] for i in ideas_data.get("ideas", [])}
                if entity_id not in idea_ids:
                    print(f"WARNING: Idea '{entity_id}' not found in ideas.json",
                          file=sys.stderr)
        elif entity_type == "task":
            tracker_file = Path("forge_output") / args.project / "tracker.json"
            if tracker_file.exists():
                tracker_data = json.loads(tracker_file.read_text(encoding="utf-8"))
                task_ids = {t["id"] for t in tracker_data.get("tasks", [])}
                if entity_id not in task_ids:
                    print(f"WARNING: Task '{entity_id}' not found in tracker.json",
                          file=sys.stderr)

    data = load_or_create(args.project)
    timestamp = now_iso()

    existing_ids = [
        int(r["id"].split("-")[1]) for r in data.get("risks", [])
        if r.get("id", "").startswith("R-")
    ]
    next_id = max(existing_ids, default=0) + 1

    added = []
    for item in new_risks:
        risk = {
            "id": f"R-{next_id:03d}",
            "title": item["title"],
            "description": item["description"],
            "linked_entity_type": item["linked_entity_type"],
            "linked_entity_id": item["linked_entity_id"],
            "severity": item["severity"],
            "likelihood": item["likelihood"],
            "mitigation_plan": item.get("mitigation_plan", ""),
            "resolution_notes": item.get("resolution_notes", ""),
            "tags": item.get("tags", []),
            "status": "OPEN",
            "created": timestamp,
            "updated": timestamp,
        }
        data["risks"].append(risk)
        added.append(risk["id"])
        next_id += 1

    save_json(args.project, data)

    status_counts = _status_counts(data)
    print(f"Risks saved: {args.project}")
    print(f"  Added: {len(added)} ({', '.join(added)})")
    print(f"  Total: {len(data['risks'])} | {_format_counts(status_counts)}")


def cmd_read(args):
    """Read risks (optionally filtered)."""
    path = risks_path(args.project)
    if not path.exists():
        print(f"No risks for '{args.project}' yet.")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    risks = data.get("risks", [])

    if args.status:
        risks = [r for r in risks if r.get("status") == args.status]
    if args.entity:
        risks = [r for r in risks if r.get("linked_entity_id") == args.entity]

    risks.sort(key=lambda r: r.get("id", ""))

    print(f"## Risks: {args.project}")
    filters = []
    if args.status:
        filters.append(f"status={args.status}")
    if args.entity:
        filters.append(f"entity={args.entity}")
    if filters:
        print(f"Filter: {', '.join(filters)}")
    print(f"Count: {len(risks)}")
    print()

    if not risks:
        print("(none)")
        return

    # Risk matrix header
    print("| ID | Severity | Likelihood | Status | Entity | Title |")
    print("|----|----------|------------|--------|--------|-------|")
    for r in risks:
        title = r.get("title", "")[:40]
        entity = r.get("linked_entity_id", "")
        print(f"| {r['id']} | {r.get('severity', '')} | {r.get('likelihood', '')} | {r.get('status', '')} | {entity} | {title} |")


def cmd_update(args):
    """Update risk fields and status."""
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
        risk = None
        for r in data.get("risks", []):
            if r["id"] == u["id"]:
                risk = r
                break
        if risk is None:
            print(f"  WARNING: Risk {u['id']} not found, skipping", file=sys.stderr)
            continue

        # Validate status transition
        if "status" in u:
            new_status = u["status"]
            current = risk["status"]
            if new_status not in VALID_TRANSITIONS.get(current, set()):
                print(f"  WARNING: Invalid transition {current}→{new_status} for {u['id']}. "
                      f"Valid: {', '.join(sorted(VALID_TRANSITIONS.get(current, set()))) or 'none'}",
                      file=sys.stderr)
                continue

        # Apply updates in-place
        updatable = ["title", "description", "status", "severity", "likelihood",
                     "mitigation_plan", "resolution_notes", "tags"]
        for field in updatable:
            if field in u:
                risk[field] = u[field]

        risk["updated"] = timestamp
        updated.append(u["id"])

    save_json(args.project, data)

    status_counts = _status_counts(data)
    print(f"Updated {len(updated)} risks: {args.project}")
    for risk_id in updated:
        risk = next(r for r in data["risks"] if r["id"] == risk_id)
        print(f"  {risk_id}: {risk.get('title', '')[:40]} ({risk.get('status', '')})")
    print(f"  {_format_counts(status_counts)}")


def cmd_show(args):
    """Show full risk details."""
    path = risks_path(args.project)
    if not path.exists():
        print(f"No risks for '{args.project}' yet.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text(encoding="utf-8"))
    risk = find_risk(data, args.risk_id)

    # Severity/likelihood matrix indicator
    matrix = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    score = matrix.get(risk.get("severity", "LOW"), 1) * matrix.get(risk.get("likelihood", "LOW"), 1)
    level = "CRITICAL" if score >= 6 else "SIGNIFICANT" if score >= 3 else "MINOR"

    print(f"## Risk {risk['id']}: {risk['title']}")
    print()
    print(f"- **Status**: {risk['status']}")
    print(f"- **Severity**: {risk.get('severity', '')}")
    print(f"- **Likelihood**: {risk.get('likelihood', '')}")
    print(f"- **Risk Level**: {level} (score: {score}/9)")
    print(f"- **Linked to**: {risk.get('linked_entity_type', '')} {risk.get('linked_entity_id', '')}")
    print(f"- **Created**: {risk.get('created', '')}")
    print(f"- **Updated**: {risk.get('updated', '')}")
    if risk.get("tags"):
        print(f"- **Tags**: {', '.join(risk['tags'])}")
    print()

    print("### Description")
    print(risk.get("description", ""))
    print()

    if risk.get("mitigation_plan"):
        print("### Mitigation Plan")
        print(risk["mitigation_plan"])
        print()

    if risk.get("resolution_notes"):
        print("### Resolution Notes")
        print(risk["resolution_notes"])
        print()

    # Next steps hint
    if risk["status"] == "OPEN":
        print("**Next**: Analyze the risk, then update to ANALYZING, MITIGATED, or ACCEPTED")
    elif risk["status"] == "ANALYZING":
        print("**Next**: Define mitigation plan, then update to MITIGATED or ACCEPTED")
    elif risk["status"] == "MITIGATED":
        print("**Next**: Verify mitigation works, then CLOSE")


def cmd_contract(args):
    """Print contract spec."""
    if args.name not in CONTRACTS:
        print(f"ERROR: Unknown contract '{args.name}'", file=sys.stderr)
        print(f"Available: {', '.join(sorted(CONTRACTS.keys()))}", file=sys.stderr)
        sys.exit(1)
    print(render_contract(args.name, CONTRACTS[args.name]))


# -- Helpers --

def _status_counts(data: dict) -> dict:
    counts = {}
    for r in data.get("risks", []):
        s = r.get("status", "OPEN")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _format_counts(counts: dict) -> str:
    parts = []
    for status in ["OPEN", "ANALYZING", "MITIGATED", "ACCEPTED", "CLOSED"]:
        if counts.get(status, 0) > 0:
            parts.append(f"{status}: {counts[status]}")
    return " | ".join(parts) if parts else "empty"


# -- CLI --

def main():
    parser = argparse.ArgumentParser(
        description="Forge Risks -- risk identification, tracking, and mitigation")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("add", help="Add risks")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("read", help="Read risks")
    p.add_argument("project")
    p.add_argument("--status", help="Filter by status")
    p.add_argument("--entity", help="Filter by linked entity ID")

    p = sub.add_parser("update", help="Update risks")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("show", help="Show full risk details")
    p.add_argument("project")
    p.add_argument("risk_id")

    p = sub.add_parser("contract", help="Print contract spec")
    p.add_argument("name", choices=sorted(CONTRACTS.keys()))

    args = parser.parse_args()

    commands = {
        "add": cmd_add,
        "read": cmd_read,
        "update": cmd_update,
        "show": cmd_show,
        "contract": cmd_contract,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

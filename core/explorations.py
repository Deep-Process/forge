"""
Explorations — structured artifacts from idea exploration and analysis.

An Exploration is a discrete analysis artifact linked to an Idea.
Multiple explorations can exist per idea (domain, architecture, risk, etc.).
Each captures findings, options, and recommendations from a specific
angle of analysis.

Types:
    domain        — understanding the problem space, stakeholders, constraints
    architecture  — system design, component structure, integration patterns
    business      — business model, ROI, market fit, competitive landscape
    risk          — threat identification and initial assessment
    feasibility   — GO/NO-GO analysis with blockers and confidence

Usage:
    python -m core.explorations <command> <project> [options]

Commands:
    add      {project} --data '{json}'                Add explorations
    read     {project} [--idea X] [--type X]          Read explorations
    show     {project} {exploration_id}               Show full details
    contract {name}                                   Print contract spec
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

def explorations_path(project: str) -> Path:
    return Path("forge_output") / project / "explorations.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_or_create(project: str) -> dict:
    path = explorations_path(project)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "project": project,
        "updated": now_iso(),
        "explorations": [],
    }


def save_json(project: str, data: dict):
    path = explorations_path(project)
    data["updated"] = now_iso()
    atomic_write_json(path, data)


# -- Contracts --

CONTRACTS = {
    "add": {
        "required": ["idea_id", "exploration_type", "summary", "findings"],
        "optional": ["options", "open_questions", "recommendation",
                      "blockers", "confidence", "ready_for_tracker",
                      "evidence_refs", "tags"],
        "enums": {
            "exploration_type": {"domain", "architecture", "business",
                                 "risk", "feasibility"},
            "confidence": {"HIGH", "MEDIUM", "LOW"},
        },
        "types": {
            "findings": list,
            "options": list,
            "open_questions": list,
            "blockers": list,
            "evidence_refs": list,
            "tags": list,
            "ready_for_tracker": bool,
        },
        "invariant_texts": [
            "idea_id: existing idea ID (I-NNN) this exploration belongs to",
            "exploration_type: domain, architecture, business, risk, or feasibility",
            "summary: concise summary of what was explored and key conclusion",
            "findings: list of specific findings (strings or objects with 'finding' and 'detail')",
            "options: list of options considered (each: {name, pros, cons, recommendation})",
            "open_questions: unresolved questions that need further analysis",
            "recommendation: overall recommendation from this exploration",
            "blockers: (feasibility type) list of blocking issues preventing implementation",
            "confidence: (feasibility type) HIGH/MEDIUM/LOW confidence in the assessment",
            "ready_for_tracker: (feasibility type) true if idea is ready for tracker onboarding",
            "evidence_refs: references to files, URLs, or documents supporting findings",
        ],
        "example": [
            {
                "idea_id": "I-001",
                "exploration_type": "architecture",
                "summary": "Event-driven architecture with Redis pub/sub is the best fit for the caching layer.",
                "findings": [
                    "Current DB queries average 200ms, caching can reduce to <10ms",
                    "Redis cluster mode supports horizontal scaling",
                    "Cache invalidation via pub/sub avoids stale data"
                ],
                "options": [
                    {"name": "Redis", "pros": ["Fast", "Pub/sub built-in"], "cons": ["Extra infra"], "recommendation": "GO"},
                    {"name": "In-memory cache", "pros": ["No infra"], "cons": ["No sharing between instances"], "recommendation": "NO-GO"}
                ],
                "recommendation": "Use Redis with pub/sub for cache invalidation",
                "open_questions": ["What TTL policy? Per-endpoint or global?"],
            },
            {
                "idea_id": "I-001",
                "exploration_type": "feasibility",
                "summary": "Implementation is feasible with 2-week timeline.",
                "findings": [
                    "Redis client library available for our stack",
                    "Team has Redis experience from previous project"
                ],
                "blockers": [],
                "confidence": "HIGH",
                "ready_for_tracker": True,
            },
        ],
    },
}


# -- Commands --

def cmd_add(args):
    """Add exploration records."""
    try:
        new_items = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(new_items, list):
        print("ERROR: --data must be a JSON array", file=sys.stderr)
        sys.exit(1)

    errors = validate_contract(CONTRACTS["add"], new_items)
    if errors:
        print(f"ERROR: {len(errors)} validation issues:", file=sys.stderr)
        for e in errors[:10]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    # Cross-validate idea_ids exist
    ideas_file = Path("forge_output") / args.project / "ideas.json"
    idea_ids = set()
    if ideas_file.exists():
        ideas_data = json.loads(ideas_file.read_text(encoding="utf-8"))
        idea_ids = {i["id"] for i in ideas_data.get("ideas", [])}

    for item in new_items:
        if item["idea_id"] not in idea_ids:
            print(f"WARNING: Idea '{item['idea_id']}' not found in ideas.json",
                  file=sys.stderr)

    data = load_or_create(args.project)
    timestamp = now_iso()

    existing_ids = [
        int(e["id"].split("-")[1]) for e in data.get("explorations", [])
        if e.get("id", "").startswith("E-")
    ]
    next_id = max(existing_ids, default=0) + 1

    added = []
    for item in new_items:
        exploration = {
            "id": f"E-{next_id:03d}",
            "idea_id": item["idea_id"],
            "exploration_type": item["exploration_type"],
            "summary": item["summary"],
            "findings": item["findings"],
            "options": item.get("options", []),
            "open_questions": item.get("open_questions", []),
            "recommendation": item.get("recommendation", ""),
            "blockers": item.get("blockers", []),
            "confidence": item.get("confidence", ""),
            "ready_for_tracker": item.get("ready_for_tracker", False),
            "evidence_refs": item.get("evidence_refs", []),
            "tags": item.get("tags", []),
            "created": timestamp,
        }
        data["explorations"].append(exploration)
        added.append(exploration["id"])
        next_id += 1

    save_json(args.project, data)

    print(f"Explorations saved: {args.project}")
    print(f"  Added: {len(added)} ({', '.join(added)})")
    print(f"  Total: {len(data['explorations'])}")


def cmd_read(args):
    """Read explorations (optionally filtered)."""
    path = explorations_path(args.project)
    if not path.exists():
        print(f"No explorations for '{args.project}' yet.")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    explorations = data.get("explorations", [])

    if args.idea:
        explorations = [e for e in explorations if e.get("idea_id") == args.idea]
    if args.type:
        explorations = [e for e in explorations if e.get("exploration_type") == args.type]

    explorations.sort(key=lambda e: e.get("id", ""))

    print(f"## Explorations: {args.project}")
    filters = []
    if args.idea:
        filters.append(f"idea={args.idea}")
    if args.type:
        filters.append(f"type={args.type}")
    if filters:
        print(f"Filter: {', '.join(filters)}")
    print(f"Count: {len(explorations)}")
    print()

    if not explorations:
        print("(none)")
        return

    print("| ID | Idea | Type | Summary |")
    print("|----|------|------|---------|")
    for e in explorations:
        summary = e.get("summary", "")[:50]
        print(f"| {e['id']} | {e.get('idea_id', '')} | {e.get('exploration_type', '')} | {summary} |")


def cmd_show(args):
    """Show full exploration details."""
    path = explorations_path(args.project)
    if not path.exists():
        print(f"No explorations for '{args.project}' yet.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text(encoding="utf-8"))
    exploration = None
    for e in data.get("explorations", []):
        if e["id"] == args.exploration_id:
            exploration = e
            break

    if not exploration:
        print(f"ERROR: Exploration '{args.exploration_id}' not found.", file=sys.stderr)
        sys.exit(1)

    print(f"## Exploration {exploration['id']}: {exploration.get('exploration_type', '')}")
    print(f"**Idea**: {exploration.get('idea_id', '')}")
    print(f"**Created**: {exploration.get('created', '')}")
    print()

    print("### Summary")
    print(exploration.get("summary", ""))
    print()

    findings = exploration.get("findings", [])
    if findings:
        print(f"### Findings ({len(findings)})")
        for f in findings:
            if isinstance(f, dict):
                print(f"- **{f.get('finding', '')}**: {f.get('detail', '')}")
            else:
                print(f"- {f}")
        print()

    options = exploration.get("options", [])
    if options:
        print(f"### Options ({len(options)})")
        for o in options:
            if isinstance(o, dict):
                print(f"- **{o.get('name', '')}**: {o.get('recommendation', '')}")
                if o.get("pros"):
                    print(f"  Pros: {', '.join(o['pros'])}")
                if o.get("cons"):
                    print(f"  Cons: {', '.join(o['cons'])}")
            else:
                print(f"- {o}")
        print()

    if exploration.get("recommendation"):
        print("### Recommendation")
        print(exploration["recommendation"])
        print()

    open_q = exploration.get("open_questions", [])
    if open_q:
        print(f"### Open Questions ({len(open_q)})")
        for q in open_q:
            print(f"- {q}")
        print()

    blockers = exploration.get("blockers", [])
    if blockers:
        print(f"### Blockers ({len(blockers)})")
        for b in blockers:
            print(f"- {b}")
        print()

    if exploration.get("confidence"):
        print(f"**Confidence**: {exploration['confidence']}")
    if "ready_for_tracker" in exploration:
        ready = "YES" if exploration["ready_for_tracker"] else "NO"
        print(f"**Ready for tracker**: {ready}")

    evidence = exploration.get("evidence_refs", [])
    if evidence:
        print()
        print(f"### Evidence ({len(evidence)})")
        for ref in evidence:
            print(f"- {ref}")


def cmd_contract(args):
    """Print contract spec."""
    if args.name not in CONTRACTS:
        print(f"ERROR: Unknown contract '{args.name}'", file=sys.stderr)
        print(f"Available: {', '.join(sorted(CONTRACTS.keys()))}", file=sys.stderr)
        sys.exit(1)
    print(render_contract(args.name, CONTRACTS[args.name]))


# -- CLI --

def main():
    parser = argparse.ArgumentParser(
        description="Forge Explorations -- structured analysis artifacts for ideas")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("add", help="Add explorations")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("read", help="Read explorations")
    p.add_argument("project")
    p.add_argument("--idea", help="Filter by idea ID")
    p.add_argument("--type", help="Filter by exploration type")

    p = sub.add_parser("show", help="Show full exploration details")
    p.add_argument("project")
    p.add_argument("exploration_id")

    p = sub.add_parser("contract", help="Print contract spec")
    p.add_argument("name", choices=sorted(CONTRACTS.keys()))

    args = parser.parse_args()

    commands = {
        "add": cmd_add,
        "read": cmd_read,
        "show": cmd_show,
        "contract": cmd_contract,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

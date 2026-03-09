"""
One-time migration: merge explorations.json and risks.json into decisions.json.

Usage:
    python migrate_to_unified_decisions.py

Scans all projects in forge_output/ and migrates data.
Original files are renamed to .bak (not deleted).
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

FORGE_OUTPUT = Path("forge_output")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def migrate_project(project_dir: Path):
    project = project_dir.name
    decisions_file = project_dir / "decisions.json"
    explorations_file = project_dir / "explorations.json"
    risks_file = project_dir / "risks.json"

    # Load existing decisions
    if decisions_file.exists():
        data = json.loads(decisions_file.read_text(encoding="utf-8"))
    else:
        data = {"project": project, "updated": now_iso(), "decisions": [], "open_count": 0}

    # Find next D-NNN ID
    existing_ids = [
        int(d["id"].split("-")[1]) for d in data.get("decisions", [])
        if d.get("id", "").startswith("D-")
    ]
    next_id = max(existing_ids, default=0) + 1

    migrated_explorations = 0
    migrated_risks = 0

    # Migrate explorations
    if explorations_file.exists():
        exp_data = json.loads(explorations_file.read_text(encoding="utf-8"))
        for e in exp_data.get("explorations", []):
            decision = {
                "id": f"D-{next_id:03d}",
                "task_id": e.get("idea_id", ""),
                "type": "exploration",
                "issue": e.get("summary", "Exploration"),
                "recommendation": e.get("recommendation", ""),
                "reasoning": "",
                "alternatives": [],
                "confidence": e.get("confidence", "MEDIUM"),
                "status": "CLOSED",
                "decided_by": "claude",
                "file": "",
                "scope": "",
                "timestamp": e.get("created", now_iso()),
                "exploration_type": e.get("exploration_type", ""),
                "findings": e.get("findings", []),
                "options": e.get("options", []),
                "open_questions": e.get("open_questions", []),
                "blockers": e.get("blockers", []),
                "ready_for_tracker": e.get("ready_for_tracker", False),
                "evidence_refs": e.get("evidence_refs", []),
                "tags": e.get("tags", []),
                "_migrated_from": e.get("id", ""),
            }
            data["decisions"].append(decision)
            next_id += 1
            migrated_explorations += 1

        # Archive original
        explorations_file.rename(explorations_file.with_suffix(".json.bak"))

    # Migrate risks
    if risks_file.exists():
        risk_data = json.loads(risks_file.read_text(encoding="utf-8"))
        for r in risk_data.get("risks", []):
            decision = {
                "id": f"D-{next_id:03d}",
                "task_id": r.get("linked_entity_id", ""),
                "type": "risk",
                "issue": r.get("title", "Risk"),
                "recommendation": r.get("mitigation_plan", ""),
                "reasoning": r.get("description", ""),
                "alternatives": [],
                "confidence": "MEDIUM",
                "status": r.get("status", "OPEN"),
                "decided_by": "claude",
                "file": "",
                "scope": "",
                "timestamp": r.get("created", now_iso()),
                "severity": r.get("severity", "MEDIUM"),
                "likelihood": r.get("likelihood", "MEDIUM"),
                "linked_entity_type": r.get("linked_entity_type", ""),
                "linked_entity_id": r.get("linked_entity_id", ""),
                "mitigation_plan": r.get("mitigation_plan", ""),
                "resolution_notes": r.get("resolution_notes", ""),
                "tags": r.get("tags", []),
                "_migrated_from": r.get("id", ""),
            }
            data["decisions"].append(decision)
            next_id += 1
            migrated_risks += 1

        # Archive original
        risks_file.rename(risks_file.with_suffix(".json.bak"))

    if migrated_explorations > 0 or migrated_risks > 0:
        # Update open_count
        data["open_count"] = sum(1 for d in data["decisions"] if d.get("status") == "OPEN")
        data["updated"] = now_iso()

        # Write updated decisions
        decisions_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

        print(f"  {project}: migrated {migrated_explorations} explorations + {migrated_risks} risks")
    else:
        print(f"  {project}: nothing to migrate")


def main():
    if not FORGE_OUTPUT.exists():
        print("No forge_output/ directory found.")
        return

    projects = [d for d in FORGE_OUTPUT.iterdir() if d.is_dir()]
    if not projects:
        print("No projects found in forge_output/.")
        return

    print(f"Migrating {len(projects)} projects...")
    for project_dir in sorted(projects):
        migrate_project(project_dir)

    print("\nDone. Original files renamed to .json.bak")


if __name__ == "__main__":
    main()

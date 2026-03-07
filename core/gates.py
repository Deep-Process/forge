"""
Gates — validation checks that guard pipeline transitions.

A gate is a shell command (test, lint, type-check) that must pass before
a task can be confidently marked DONE. Gates are configured per-project
and stored in tracker.json.

Usage:
    python -m core.gates <command> <project> [options]

Commands:
    check    {project} [--task X]        Run all configured gates
    config   {project} --data '{json}'   Configure gates
    show     {project}                   Show current gate config
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


# -- Paths --

def tracker_path(project: str) -> Path:
    return Path("forge_output") / project / "tracker.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_tracker(project: str) -> dict:
    path = tracker_path(project)
    if not path.exists():
        print(f"ERROR: No tracker for project '{project}'.", file=sys.stderr)
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def save_tracker(project: str, tracker: dict):
    path = tracker_path(project)
    tracker["updated"] = now_iso()
    path.write_text(
        json.dumps(tracker, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# -- Commands --

def cmd_config(args):
    """Configure gates for the project."""
    tracker = load_tracker(args.project)

    try:
        gates = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(gates, list):
        print("ERROR: --data must be a JSON array of gate objects", file=sys.stderr)
        sys.exit(1)

    for g in gates:
        if "name" not in g or "command" not in g:
            print("ERROR: Each gate must have 'name' and 'command'", file=sys.stderr)
            sys.exit(1)

    tracker["gates"] = gates
    save_tracker(args.project, tracker)

    print(f"Gates configured for '{args.project}':")
    for g in gates:
        req = "required" if g.get("required", True) else "advisory"
        print(f"  {g['name']}: {g['command']} ({req})")


def cmd_show(args):
    """Show current gate configuration."""
    tracker = load_tracker(args.project)
    gates = tracker.get("gates", [])

    if not gates:
        print(f"No gates configured for '{args.project}'.")
        print()
        print("Configure with:")
        print(f'  python -m core.gates config {args.project} --data \'[{{"name": "test", "command": "pytest", "required": true}}, {{"name": "lint", "command": "ruff check .", "required": true}}]\'')
        return

    print(f"## Gates: {args.project}")
    print()
    print("| Name | Command | Required |")
    print("|------|---------|----------|")
    for g in gates:
        req = "yes" if g.get("required", True) else "no"
        print(f"| {g['name']} | `{g['command']}` | {req} |")


def cmd_check(args):
    """Run all configured gates."""
    tracker = load_tracker(args.project)
    gates = tracker.get("gates", [])

    if not gates:
        print(f"No gates configured for '{args.project}'. Skipping validation.")
        print(f"Configure with: python -m core.gates config {args.project} --data '[...]'")
        return

    print(f"## Running gates: {args.project}")
    if args.task:
        print(f"Task: {args.task}")
    print()

    results = []
    all_passed = True
    required_failed = False

    for g in gates:
        name = g["name"]
        command = g["command"]
        required = g.get("required", True)

        print(f"  Running: {name} ({command})... ", end="", flush=True)

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=120,
            )
            passed = result.returncode == 0
        except subprocess.TimeoutExpired:
            passed = False
            result = type("R", (), {"stdout": "", "stderr": "Timed out after 120s", "returncode": -1})()
        except Exception as e:
            passed = False
            result = type("R", (), {"stdout": "", "stderr": str(e), "returncode": -1})()

        status = "PASS" if passed else "FAIL"
        print(status)

        if not passed:
            all_passed = False
            if required:
                required_failed = True
            # Show first few lines of error output
            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            output = stderr or stdout
            if output:
                for line in output.split("\n")[:5]:
                    print(f"    {line}")

        results.append({
            "name": name,
            "command": command,
            "passed": passed,
            "required": required,
            "output": (result.stderr or result.stdout or "")[:500],
        })

    # Store results on task if specified
    if args.task:
        for task in tracker.get("tasks", []):
            if task["id"] == args.task:
                task["gate_results"] = {
                    "timestamp": now_iso(),
                    "all_passed": all_passed,
                    "results": [{"name": r["name"], "passed": r["passed"]} for r in results],
                }
                break
        save_tracker(args.project, tracker)

    print()
    if all_passed:
        print("All gates passed.")
    elif required_failed:
        print("REQUIRED gates failed. Fix issues before marking task DONE.")
    else:
        print("Advisory gates failed (non-blocking). Consider fixing before proceeding.")

    return all_passed


# -- CLI --

def main():
    parser = argparse.ArgumentParser(description="Forge Gates -- validation checks")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("config", help="Configure gates")
    p.add_argument("project")
    p.add_argument("--data", required=True)

    p = sub.add_parser("show", help="Show gate config")
    p.add_argument("project")

    p = sub.add_parser("check", help="Run gates")
    p.add_argument("project")
    p.add_argument("--task", help="Associate results with task")

    args = parser.parse_args()

    commands = {
        "config": cmd_config,
        "show": cmd_show,
        "check": cmd_check,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

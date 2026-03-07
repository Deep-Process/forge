"""
Recipes — reusable task graph templates for common operations.

Instead of decomposing from scratch every time, /plan can use a recipe
as a starting point for standard patterns (API endpoint, bug fix, refactor).

Usage:
    python -m core.recipes <command> [options]

Commands:
    list                                     List available recipes
    show     {recipe-name}                   Show recipe details
    apply    {project} {recipe-name} --vars '{json}'  Apply recipe to project
"""

import argparse
import json
import os
import sys
from pathlib import Path

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


# -- Paths --

def recipes_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "recipes"


def load_recipe(name: str) -> dict:
    path = recipes_dir() / f"{name}.json"
    if not path.exists():
        print(f"ERROR: Recipe '{name}' not found.", file=sys.stderr)
        print(f"Available: {', '.join(list_recipe_names())}", file=sys.stderr)
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def list_recipe_names() -> list:
    rd = recipes_dir()
    if not rd.exists():
        return []
    return sorted(p.stem for p in rd.glob("*.json"))


def substitute_vars(text: str, variables: dict) -> str:
    """Replace {var_name} placeholders with values."""
    for key, value in variables.items():
        text = text.replace(f"{{{key}}}", str(value))
    return text


# -- Commands --

def cmd_list(args):
    """List available recipes."""
    names = list_recipe_names()
    if not names:
        print("No recipes found.")
        return

    print("## Available Recipes")
    print()
    print("| Name | Description | Tasks | Variables |")
    print("|------|-------------|-------|-----------|")

    for name in names:
        recipe = load_recipe(name)
        desc = recipe.get("description", "")[:50]
        task_count = len(recipe.get("tasks", []))
        variables = ", ".join(recipe.get("variables", []))
        print(f"| {name} | {desc} | {task_count} | {variables} |")

    print()
    print("Use `python -m core.recipes show {name}` for details.")


def cmd_show(args):
    """Show recipe details."""
    recipe = load_recipe(args.name)

    print(f"## Recipe: {recipe['name']}")
    print(f"Description: {recipe.get('description', '')}")
    print()

    variables = recipe.get("variables", [])
    if variables:
        print(f"### Variables (required)")
        for v in variables:
            print(f"  - `{v}`")
        print()

    print(f"### Tasks ({len(recipe['tasks'])})")
    print()
    print("| ID | Name | Description | Depends On |")
    print("|-----|------|-------------|------------|")
    for t in recipe["tasks"]:
        deps = ", ".join(t.get("depends_on", [])) or "--"
        print(f"| {t['id']} | {t['name']} | {t['description'][:50]} | {deps} |")

    print()
    print("### Apply")
    vars_example = {v: f"<{v}>" for v in variables}
    print(f"  python -m core.recipes apply {{project}} {recipe['name']} --vars '{json.dumps(vars_example)}'")


def cmd_apply(args):
    """Apply a recipe to a project by adding its tasks."""
    recipe = load_recipe(args.name)

    # Parse variables
    variables = {}
    if args.vars:
        try:
            variables = json.loads(args.vars)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON for --vars: {e}", file=sys.stderr)
            sys.exit(1)

    # Check all required variables are provided
    required = recipe.get("variables", [])
    missing = [v for v in required if v not in variables]
    if missing:
        print(f"ERROR: Missing required variables: {', '.join(missing)}", file=sys.stderr)
        print(f"Provide with: --vars '{json.dumps({v: '<value>' for v in missing})}'", file=sys.stderr)
        sys.exit(1)

    # Substitute variables in all task fields
    tasks = []
    for t in recipe["tasks"]:
        task = {}
        for key, value in t.items():
            if isinstance(value, str):
                task[key] = substitute_vars(value, variables)
            elif isinstance(value, list):
                task[key] = [substitute_vars(v, variables) if isinstance(v, str) else v for v in value]
            else:
                task[key] = value
        tasks.append(task)

    # Output as JSON for piping to pipeline add-tasks
    tasks_json = json.dumps(tasks, indent=2, ensure_ascii=False)

    print(f"## Recipe '{recipe['name']}' applied with variables:")
    for k, v in variables.items():
        print(f"  {k}: {v}")
    print()
    print(f"Generated {len(tasks)} tasks. Add to pipeline with:")
    print()
    print(f"  python -m core.pipeline add-tasks {args.project} --data '{tasks_json}'")
    print()
    print("Or copy the JSON below:")
    print()
    print("```json")
    print(tasks_json)
    print("```")


# -- CLI --

def main():
    parser = argparse.ArgumentParser(description="Forge Recipes -- task graph templates")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List available recipes")

    p = sub.add_parser("show", help="Show recipe details")
    p.add_argument("name")

    p = sub.add_parser("apply", help="Apply recipe to project")
    p.add_argument("project")
    p.add_argument("name")
    p.add_argument("--vars", default=None, help="JSON object with variable values")

    args = parser.parse_args()

    commands = {
        "list": cmd_list,
        "show": cmd_show,
        "apply": cmd_apply,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()

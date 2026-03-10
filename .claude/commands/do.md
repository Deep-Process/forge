# /do $ARGUMENTS

Quick path — execute a single task from start to finish with minimum ceremony.
Use for simple bug fixes, small features, refactors, and one-off tasks that don't need full planning.

## When to use

- Simple, well-defined task (1-2 files, clear scope)
- Bug fix with known cause
- Small refactor or chore
- Task where full /objective → /idea → /discover → /plan ceremony is overkill

## When NOT to use

- Complex multi-task work → use `/plan`
- Unclear requirements → use `/idea` + `/discover` first
- High-risk architectural changes → use full workflow

## Procedure

1. **Determine active project:**
```bash
ls forge_output/ 2>/dev/null
```

2. **If no project exists** — create a quick project:
```bash
python -m core.pipeline init "quick-$(date +%Y%m%d-%H%M%S)" --goal "$ARGUMENTS"
```

3. **If a project exists** — use it. Check status:
```bash
python -m core.pipeline status {project}
```

4. **Check task contract:**
```bash
python -m core.pipeline contract add-tasks
```

5. **Add the task:**
```bash
python -m core.pipeline add-tasks {project} --data '[{
  "name": "{slug-from-description}",
  "description": "$ARGUMENTS",
  "type": "{feature|bug|chore|investigation}",
  "acceptance_criteria": ["{inferred criterion 1}", "{inferred criterion 2}"],
  "scopes": ["general"]
}]'
```

Infer type and acceptance criteria from the description. Flag your top 2 assumptions about scope.

6. **Get the task:**
```bash
python -m core.pipeline next {project}
```

7. **Load context** (global + general guidelines only — lightweight):
```bash
python -m core.guidelines context {project} --scopes "general"
```

8. **Execute the task:**
   - Read relevant files
   - Make the changes
   - Record decisions ONLY if non-trivial (skip for simple fixes)

9. **Run gates** (if configured):
```bash
python -m core.gates check {project} --task {task_id}
```

10. **Commit:**
```bash
git add {changed files}
git commit -m "{descriptive message}"
```

11. **Complete with reasoning:**
```bash
python -m core.pipeline complete {project} {task_id} --reasoning "{what was done and why}"
```

## What /do skips (vs /next)

- Objectives, ideas, discovery (no planning layers)
- Deep-verify (no formal verification — trust the implementation)
- Full deep-align (no alignment questions — infer from description)
- Multi-step review (no 6-perspective review)

## What /do keeps (minimum traceability)

- Pipeline tracking (task exists, status tracked)
- Auto-recorded changes (pipeline complete captures git diff)
- Gates (if configured — tests/lint still run)
- Global + general guidelines (loaded and respected)
- Reasoning on complete (WHY recorded)

## Rules

- If during execution you discover the task is more complex than expected (touches 5+ files, requires architectural decisions), STOP and tell the user: "This is more complex than a /do task. Consider /plan instead."
- Always respect global guidelines (G-001 through G-004)
- Always run gates if they're configured — /do is fast, not reckless

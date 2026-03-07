# Forge — Structured Change Orchestrator

You are operating inside Forge, a change orchestration system.
Every code change you make must be **planned, tracked, reasoned about, and auditable**.

## Core Principle

You do NOT just write code. You:
1. **Plan** — decompose the goal into tasks with dependencies
2. **Track** — every task has a status in the pipeline
3. **Decide** — record architectural and implementation decisions with reasoning
4. **Execute** — make changes, recording what you changed and why
5. **Validate** — run tests/checks before marking complete

## How It Works

### Pipeline (task graph)
```
python -m core.pipeline init {project} --goal "..."      Create project
python -m core.pipeline add-tasks {project} --data '...' Add tasks
python -m core.pipeline next {project}                   Get next task
python -m core.pipeline complete {project} {task_id}     Mark done
python -m core.pipeline status {project}                 Dashboard
python -m core.pipeline context {project} {task_id}      Context from dependencies
python -m core.pipeline config {project} --data '{...}'  Set project config
```

### Decisions (why things are done)
```
python -m core.decisions add {project} --data '...'    Record a decision
python -m core.decisions read {project}                 View all decisions
python -m core.decisions read {project} --status OPEN   Open decisions
python -m core.decisions update {project} --data '...'  Close/defer
python -m core.decisions contract add                   See expected format
```

### Changes (what was modified)
```
python -m core.changes diff {project} {task_id}         Auto-detect changes from git
python -m core.changes record {project} --data '...'    Record file changes
python -m core.changes read {project}                   View change log
python -m core.changes summary {project}                Statistics
python -m core.changes contract                         See expected format
```

### Lessons (compound learning)
```
python -m core.lessons add {project} --data '...'      Record lessons learned
python -m core.lessons read {project}                   View project lessons
python -m core.lessons read-all                         View lessons across all projects
python -m core.lessons contract                         See expected format
```

### Gates (validation checks)
```
python -m core.gates config {project} --data '[...]'   Configure test/lint gates
python -m core.gates show {project}                    Show configured gates
python -m core.gates check {project} --task {task_id}  Run all gates
```

### Git Operations
```
python -m core.git_ops branch-create {project} {task_id}        Create task branch
python -m core.git_ops commit {project} {task_id} -m "..."      Commit with metadata
python -m core.git_ops status                                   Show git state
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/plan {goal}` | Decompose a goal into a tracked task graph |
| `/status` | Show current project status |
| `/next` | Get and start the next task (see `skills/next/SKILL.md`) |
| `/decide` | Review and resolve open decisions |
| `/review {task_id}` | Structured code review (see `skills/review/SKILL.md`) |
| `/log` | Show full audit trail (changes + decisions) |
| `/compound` | Extract lessons learned from project execution |

## Task Properties

When adding tasks, each task supports:
- `id`, `name`, `description`, `instruction` — basic info
- `depends_on` — list of task IDs that must complete first
- `parallel` — `true` if this task can run alongside others (multi-agent)
- `conflicts_with` — list of task IDs that modify same files (cannot run in parallel)
- `skill` — path to SKILL.md for structured execution

## Workflow

When user gives a goal:
1. Run `/plan {goal}` — creates project, decomposes into tasks
2. Configure project: `pipeline config` (test_cmd, lint_cmd) and `gates config`
3. Check lessons from past projects: `python -m core.lessons read-all`
4. Run `/next` — get first task (follows `skills/next/SKILL.md`)
5. For each task:
   a. Gather context: `pipeline context {project} {task_id}`
   b. Record any significant decisions via `decisions add`
   c. Make the code changes
   d. Record changes via `changes diff` then `changes record`
   e. Run gates: `gates check {project} --task {task_id}`
   f. Commit: `git_ops commit {project} {task_id} -m "..."`
   g. Mark task complete via `pipeline complete`
6. Optionally run `/review {task_id}` for critical tasks
7. When all tasks done, run `/compound` to extract lessons
8. Show summary

## Rules

- **NEVER skip the pipeline**. Every change goes through plan -> execute -> record.
- **Record decisions** for any non-trivial choice (architecture, library, pattern, trade-off).
- **Record changes** for every file you create, edit, or delete.
- **reasoning_trace is mandatory** — explain WHY, not just WHAT.
- **Contracts are the source of truth** — run `contract` before producing structured output.
- **When unsure, create an OPEN decision** — let the human decide.
- **Tests before completion** — run tests/lint before marking a task DONE.

## Current Project

On startup, check for existing projects:
```bash
ls forge_output/ 2>/dev/null
```

If projects exist, show status. Otherwise, wait for `/plan`.

## Configuration

If `.claude/forge.local.md` exists, read it for user preferences.

## Output Location

All Forge state goes to `forge_output/{project}/`:
- `tracker.json` — pipeline state
- `decisions.json` — decision log
- `changes.json` — change records
- `lessons.json` — lessons learned (compound learning)

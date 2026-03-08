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
python -m core.pipeline update-task {project} --data '{...}' Update existing task
python -m core.pipeline remove-task {project} {task_id}  Remove TODO task
python -m core.pipeline next {project} [--agent name]    Get next task (two-phase claim)
python -m core.pipeline complete {project} {task_id}     Mark done
python -m core.pipeline contract add-tasks               Show task contract
python -m core.pipeline contract update-task             Show update contract
python -m core.pipeline contract register-subtasks       Show subtask contract
python -m core.pipeline status {project}                 Dashboard + DAG
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

### Ideas (staging area)
```
python -m core.ideas add {project} --data '[...]'              Add ideas
python -m core.ideas read {project} [--status X] [--category X]  Read ideas
python -m core.ideas show {project} {idea_id}                  Show full idea details
python -m core.ideas update {project} --data '[...]'           Update idea status/fields
python -m core.ideas commit {project} {idea_id}                Mark ACCEPTED → COMMITTED
python -m core.ideas contract add                              Show idea contract
```

### Guidelines (project standards)
```
python -m core.guidelines add {project} --data '[...]'         Add guidelines
python -m core.guidelines read {project} [--scope X] [--weight X]  Read guidelines
python -m core.guidelines update {project} --data '[...]'      Update guideline status
python -m core.guidelines context {project} --scopes "a,b"     Guidelines for LLM context
python -m core.guidelines scopes {project}                     List unique scopes
python -m core.guidelines contract add                         Show guideline contract
```

### Gates (validation checks)
```
python -m core.gates config {project} --data '[...]'   Configure test/lint gates
python -m core.gates show {project}                    Show configured gates
python -m core.gates check {project} --task {task_id}  Run all gates
python -m core.gates scan-secrets {project}            Scan for leaked credentials
python -m core.gates contract config                   Show gate contract
```

### Recipes (task graph templates)
```
python -m core.recipes list                            List available recipes
python -m core.recipes show {name}                     Show recipe details
python -m core.recipes apply {project} {name} --vars   Apply recipe to project
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
| `/discover {topic}` | Explore options, assess risks, design architecture before planning |
| `/plan {goal}` | Decompose a goal into a tracked task graph |
| `/status` | Show current project status |
| `/next` | Get and start the next task (see `skills/next/SKILL.md`) |
| `/run [tasks]` | Execute tasks continuously: `/run`, `/run 3`, `/run T-003`, `/run T-003..T-007`, `/run T-003,T-005` |
| `/decide` | Review and resolve open decisions |
| `/review {task_id}` | Structured code review (see `skills/review/SKILL.md`) |
| `/log` | Show full audit trail (changes + decisions) |
| `/compound` | Extract lessons learned from project execution |
| `/onboard` | Import brownfield project knowledge into Forge (see `skills/onboard/SKILL.md`) |

## Task Properties

When adding tasks, each task supports:
- `id`, `name`, `description`, `instruction` — basic info
- `type` — task category: `feature` (default), `bug`, `chore`, `investigation`
- `acceptance_criteria` — list of concrete conditions that must be true when DONE
- `depends_on` — list of task IDs that must complete first
- `blocked_by_decisions` — list of decision IDs (D-001, etc.) that must be CLOSED before this task can start
- `parallel` — `true` if this task can run alongside others (multi-agent)
- `conflicts_with` — list of task IDs that modify same files (cannot run in parallel)
- `skill` — path to SKILL.md for structured execution
- `scopes` — list of guideline scopes this task relates to (e.g., `["backend", "database"]`). `general` is always included automatically. Used by `pipeline context` to load applicable guidelines.
- `origin` — where this task came from (idea ID like `I-001`, or free text)

Tasks can be modified after creation with `update-task` (only TODO/FAILED tasks).
Tasks can be removed with `remove-task` (only TODO, and only if no other tasks depend on them).

### Decision Blocking

Tasks with `blocked_by_decisions` will NOT be picked up by `next` (or `/run`) until all listed decisions are CLOSED.
This ensures architectural/design decisions are resolved before implementation begins.
Use `/decide` to review and close OPEN decisions.

## Workflow

For brownfield projects (existing codebase):
1. Run `/onboard` — discover project, import decisions/conventions, configure gates
2. Then continue with `/plan {goal}` for specific work

When user gives a goal:
1. Optionally capture as idea: `ideas add {project} --data '[...]'` — staging before commitment
   - Explore with `/discover {idea_id}` — risk, feasibility, architecture analysis
   - Update idea status: DRAFT → EXPLORING → ACCEPTED
   - Commit: `ideas commit {project} {idea_id}` when ready
2. Run `/plan {goal}` (or `/plan {idea_id}` for committed ideas) — creates tasks informed by discovery decisions and guidelines
3. Configure project: `pipeline config` (test_cmd, lint_cmd) and `gates config`
4. Define project guidelines: `guidelines add {project} --data '[...]'` — coding standards, conventions, architectural rules
5. Check lessons from past projects: `python -m core.lessons read-all`
6. Run `/next` — get first task (follows `skills/next/SKILL.md`)
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

## Multi-Agent Support

Forge supports multiple agents working on the same project in parallel.

### How it works
- Each agent identifies itself with `--agent {name}` on `next` and `complete`
- `next` uses **two-phase claim**: CLAIMING → wait → verify → IN_PROGRESS
- If two agents claim the same task simultaneously, one wins, the other backs off
- `conflicts_with` is enforced: if task A conflicts with task B, they cannot be active at the same time

### Usage
```bash
# Agent Alice gets her next task
python -m core.pipeline next {project} --agent alice

# Agent Bob gets a different task (conflicts respected)
python -m core.pipeline next {project} --agent bob

# Each agent completes their own task
python -m core.pipeline complete {project} T-001 --agent alice
python -m core.pipeline complete {project} T-002 --agent bob
```

### Rules for multi-agent
- Set `conflicts_with` on tasks that modify the same files
- Tasks with unmet dependencies are never assigned
- Tasks conflicting with an active task are blocked until it completes
- Without `--agent`, single-agent mode works as before (backward compatible)

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
- `guidelines.json` — project standards and conventions
- `ideas.json` — idea staging area (proposals, plans)

# Forge — Structured Change Orchestrator

You are operating inside Forge, a change orchestration system.
Every code change must be **planned, tracked, reasoned about, and auditable**.

## Core Principle

You do NOT just write code. You:
1. **Align** — build shared understanding before execution (deep-align)
2. **Plan** — decompose the goal into tasks with dependencies
3. **Track** — every task has a status in the pipeline
4. **Decide** — record architectural and implementation decisions with reasoning
5. **Execute** — make changes, recording what you changed and why
6. **Validate** — run tests/checks before marking complete

## Entity Hierarchy

```
Objective (why) ──→ Ideas (what) ──→ Tasks (how) ──→ Changes + Decisions
       │                  │                │
       ├─ derives Guidelines          ├─ context: Guidelines, Knowledge, Research, Risks
       ├─ researched by Research      ├─ produces contracts for downstream tasks
       └─ measured by KR progress     └─ validated by Gates

Post-project: /compound ──→ Lessons (cross-project learning)
```

### Data flow at task execution (`pipeline context`)

```
Task T-001
  │
  ├─ task.scopes ──→ load Guidelines + Knowledge matching scopes (+ global)
  │
  ├─ task.origin ──→ Idea I-001 or Objective O-001
  │   ├─ idea.advances_key_results ──→ Objective O-001 (title, KR progress)
  │   └─ Research R-NNN (summary, key_findings, decision_ids)
  │
  ├─ task.depends_on ──→ completed tasks (Changes, Decisions, produces contracts)
  │
  ├─ task.origin ──→ active Risk decisions
  │
  └─ task.blocked_by_decisions ──→ must be CLOSED before start
```

## CLI Reference

Full command reference: `docs/CLI-REFERENCE.md`. Key patterns:

```
python -m core.pipeline {init|add-tasks|draft-plan|approve-plan|begin|next|complete|status|context|config|update-task|remove-task|contract} {project} [args]
python -m core.decisions {add|read|update|show|contract} {project} [args]
python -m core.changes {auto|record|read|contract} {project} [args]
python -m core.{lessons|objectives|ideas|guidelines|knowledge|research|ac_templates|gates|domain_modules|decision_checker|git_ops} {subcommand} [args]
```

Use `--help` for full syntax. Use `contract` subcommand for entity JSON format.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/objective {title}` | Define business objective with measurable key results |
| `/idea {title}` | Add idea to staging area |
| `/discover {topic\|idea_id}` | Explore options, assess risks, design architecture |
| `/plan {goal\|idea_id}` | Decompose into task graph (draft → approve) |
| `/next` | Get and execute next task |
| `/run [tasks]` | Execute tasks continuously: `/run`, `/run 3`, `/run T-003..T-007` |
| `/decide` | Review and resolve open decisions |
| `/risk [title\|id] [action]` | Manage risks |
| `/review {task_id}` | Deep code review (critical tasks only) |
| `/compound` | Extract lessons learned |
| `/onboard` | Import brownfield project knowledge |
| `/task {description}` | Quick-add a single task |
| `/status` | Show current project status |
| `/log` | Show full audit trail |
| `/guideline {text}` / `/guidelines` | Add/manage project guidelines |
| `/knowledge`, `/research`, `/ac-template` | Manage knowledge, research, AC templates |
| `/objectives`, `/ideas` | Manage objectives and ideas |
| `/help` | Show all commands |

## Task Properties

When adding tasks, each task supports:
- `id`, `name`, `description`, `instruction` — basic info
- `type` — `feature` (default), `bug`, `chore`, `investigation`
- `acceptance_criteria` — conditions that must be true when DONE
- `depends_on` — task IDs that must complete first
- `blocked_by_decisions` — decision IDs that must be CLOSED before start
- `parallel`, `conflicts_with` — multi-agent coordination
- `skill` — path to SKILL.md for structured execution
- `scopes` — guideline scopes (e.g., `["backend", "database"]`). `general` always included.
- `origin` — source (idea ID like `I-001`, or free text)
- `knowledge_ids` — Knowledge IDs (K-001) to load as context
- `test_requirements` — `{unit, integration, e2e}` booleans
- `alignment` — `{goal, boundaries: {must, must_not, not_in_scope}, success}` — persisted from planning
- `exclusions` — task-specific DO NOT rules
- `produces` — semantic contract for downstream consumers (e.g., `{"endpoint": "POST /users → 201 {id, email}"}`)

### Validation

- **Planning**: feature/bug tasks MUST have `acceptance_criteria`. Temp IDs (`_1`, `_2`) auto-remap to `T-NNN`.
- **Completion**: changes recorded + gates passed + AC verified with `--ac-reasoning` (per-criterion + `→ Test:` mapping). Use `--force` to bypass.
- **Batch format**: `{"new_tasks": [...], "update_tasks": [...]}` for atomic add + update.

## Workflow

### Choose the right track

| Signal | Track |
|--------|-------|
| "Fix this bug", "Add a test" | **Standard** (`/task` + `/next`) |
| "Add feature X with Y and Z" | **Standard** (`/plan`) |
| "Design the system first, then build" | **Architecture-first** |
| "Redesign the auth system", full analysis | **Full** |

### Standard Track
```
/plan {goal}  ──→  /next|/run  ──→  /compound
```

### Full Track
```
/objective ──→ /idea ──→ /discover ──→ /plan ──→ /next|/run ──→ /compound
  (why)        (what)     (assess)     (how)    (execute)      (learn)
```

### Architecture-first Track
```
/objective ──→ /discover --full ──→ /knowledge add ──→ /plan ──→ /next|/run
  (why)         (design+assess)     (persist design)   (tasks)   (build)
```

Discovery findings that should persist → Knowledge objects → assigned to tasks via `knowledge_ids`.

### Brownfield Projects
Run `/onboard` first — discover project, import decisions/conventions, configure gates.

## Rules

- **NEVER skip the pipeline**. Every change goes through plan → execute → record.
- **Record decisions** for any non-trivial choice (architecture, library, pattern, trade-off).
- **Record changes** for every file you create, edit, or delete.
- **reasoning_trace is mandatory** — explain WHY, not just WHAT.
- **Contracts on first use** — run `contract` the first time you use an entity type in a session. Pipeline validates input and error messages show correct format.
- **When unsure, create an OPEN decision** — let the human decide.
- **Tests before completion** — run tests/lint before marking a task DONE.
- **Use --force on complete** only for tasks with no code changes.
- **Use `--data -` with heredoc** for complex JSON (see `docs/CLI-REFERENCE.md`).

## Current Project

On startup, check for existing projects:
```bash
ls forge_output/ 2>/dev/null
```

If projects exist, show status. Otherwise, wait for `/plan`.
If `.claude/forge.local.md` exists, read it for user preferences.

## Output Location

All Forge state goes to `forge_output/{project}/`:
- `tracker.json` — pipeline state (tasks + draft_plan)
- `decisions.json` — decisions + explorations + risks
- `changes.json` — change records
- `lessons.json` — compound learning
- `guidelines.json` — project standards
- `ideas.json` — idea staging area
- `objectives.json` — business objectives + KRs
- `knowledge.json` — domain knowledge
- `ac_templates.json` — reusable AC templates
- `research.json` — structured analysis (from /discover)

# Forge

A structured development loop for AI coding agents. Forge turns high-level goals into tracked, dependency-aware tasks — then guides execution with contracts, decisions, and validation gates so nothing falls through the cracks.

> AI agents write code fast. Forge makes sure the code is **planned, reasoned about, and auditable**.

## What Problem Does Forge Solve?

AI coding assistants generate code without structure. They don't remember why a decision was made, don't check if the change broke something upstream, and can't resume where they left off. Forge fixes this by wrapping every code change in a discipline loop:

1. **Align** — build shared understanding before touching code
2. **Plan** — decompose the goal into tasks with explicit dependencies
3. **Decide** — record every non-trivial choice (architecture, library, trade-off)
4. **Execute** — make changes, guided by project guidelines and prior context
5. **Record** — log what changed and *why* (reasoning trace, not just diffs)
6. **Validate** — run tests, lint, secret scanning before marking done

The result: a full audit trail from business goal down to individual file edits, resumable at any point.

## How It Works

### The Three Tracks

Forge adapts ceremony to task complexity:

```
/do Fix the login timeout bug          ← Quick track (80% of tasks)
                                           One task, start to finish, minimum overhead.

/plan Add Redis caching to the API      ← Standard track
                                           Decompose → dependency DAG → execute in order.

/objective Reduce API response time     ← Full track (complex/risky work)
/idea Redis caching layer                  Why → What → Explore → Plan → Execute → Learn
/discover I-001
/plan I-001
```

### The Development Loop

```
         ┌──────────────────────────────────────────────────┐
         │                                                  │
    /objective  ──→  /idea  ──→  /discover  ──→  /plan      │
      (why)        (what)      (assess)       (how)         │
         │                                                  │
         │     ┌────────────────────────────────────┐       │
         │     │  For each task:                    │       │
         └──→  │  1. Load context (deps + guidelines)│      │
               │  2. Execute code changes            │      │
               │  3. Record decisions                │      │
               │  4. Run gates (test/lint)           │      │
               │  5. Mark complete (auto-records git)│      │
               └────────────────────────────────────┘       │
                              │                             │
                        /compound  ──→  lessons ───────────→┘
                          (learn)       (feed next project)
```

### Entity Flow

Everything connects:

```
Objective O-001 "Reduce p95 latency"        ← Business goal with measurable KRs
  ├── Guideline G-010 "Latency benchmarks"  ← Standards (loaded by scope into task context)
  ├── Research R-001 "Caching options"       ← Structured analysis output
  ├── Idea I-001 "Redis caching layer"      ← Proposal (advances KR-1)
  │     ├── Decision D-001 (exploration)    ← Options explored, risks assessed
  │     └── Decision D-002 (risk)           ← Severity, likelihood, mitigation
  └── Task T-001 "setup-redis"              ← Execution unit
        ├── Context loads: guidelines, research, dependency outputs, active risks
        ├── Changes auto-recorded on complete (git diff → reasoning trace)
        └── Gates checked before DONE
```

## Forge Core (Python Engine)

Forge core is a set of Python modules that manage state in JSON files. No database required — everything lives in `forge_output/{project}/`.

### Pipeline — Task Graph

Tasks form a DAG with dependencies. The pipeline enforces order, detects conflicts, and supports parallel multi-agent execution.

```bash
python -m core.pipeline init myproject --goal "Build a REST API"
python -m core.pipeline draft-plan myproject --data '[...]'   # Draft → review
python -m core.pipeline approve-plan myproject                # Approve → materialize
python -m core.pipeline next myproject                        # Get next ready task
python -m core.pipeline complete myproject T-001 --reasoning "Added Redis connection pool"
python -m core.pipeline status myproject                      # Dashboard + DAG
```

Task states: `TODO → IN_PROGRESS → DONE` (or `FAILED` / `SKIPPED`). Each task carries: acceptance criteria, scopes (for guideline loading), origin (idea or objective), knowledge references, and test requirements.

### Decisions — The Why Log

Every non-trivial choice gets recorded — architecture, library selection, trade-offs, and risks. Three types unified under one system:

- **Standard** — architecture, implementation, security, naming, etc.
- **Exploration** (type=exploration) — findings, options, open questions from `/discover`
- **Risk** (type=risk) — severity, likelihood, mitigation plan

```bash
python -m core.decisions add myproject --data '[...]'
python -m core.decisions read myproject --status OPEN
python -m core.decisions read myproject --type risk
```

Tasks can be **blocked by decisions** — they won't start until the decision is CLOSED. This forces architectural alignment before implementation.

### Changes — What and Why

Every file modification is tracked with a mandatory `reasoning_trace` — not just *what* changed but *why*. Auto-recorded from git diff on task completion.

```bash
python -m core.changes auto myproject T-001 --reasoning "Added connection pool for Redis"
python -m core.changes summary myproject
```

### Gates — Validation Before Done

Configurable per project: tests, lint, type-check, secret scanning. Required gates block task completion until fixed.

```bash
python -m core.gates config myproject --data '[{"name": "test", "command": "pytest", "required": true}]'
python -m core.gates check myproject --task T-001
```

### Guidelines — Project Standards

Scoped (`backend`, `frontend`, `database`, etc.) and weighted (`must` / `should` / `may`). Automatically injected into task context during execution based on task scopes.

```bash
python -m core.guidelines add myproject --data '[{"title": "Use Repository Pattern", "scope": "backend", "weight": "must", ...}]'
python -m core.guidelines context myproject --scopes "backend,database"
```

### Other Entities

| Entity | Purpose | Command |
|--------|---------|---------|
| **Objectives** | Business goals with measurable Key Results | `python -m core.objectives` |
| **Ideas** | Hierarchical proposals (DRAFT → EXPLORING → APPROVED → COMMITTED) | `python -m core.ideas` |
| **Research** | Structured analysis output linked to objectives/ideas | `python -m core.research` |
| **Knowledge** | Domain context — rules, patterns, API references (versioned) | `python -m core.knowledge` |
| **AC Templates** | Reusable parameterized acceptance criteria | `python -m core.ac_templates` |
| **Lessons** | Cross-project learning extracted via `/compound` | `python -m core.lessons` |

## Contracts — Why They Exist

Every entity has a **contract**: a schema that defines the exact shape of data the module accepts. Run `python -m core.{module} contract {action}` to see it.

Contracts serve two purposes:
1. **For the AI agent** — the contract is injected into the prompt so the LLM knows exactly what JSON to produce. No guessing, no hallucinated fields.
2. **For validation** — Python validates the LLM output against the contract before writing to disk. If it doesn't match, the operation fails with a clear error.

This is the Python/LLM boundary: Python handles I/O and validation, the LLM handles judgment. The contract is the handshake between them.

```bash
python -m core.pipeline contract add-tasks    # See task schema
python -m core.decisions contract add          # See decision schema
python -m core.guidelines contract add         # See guideline schema
```

## Skills — Reusable Agent Procedures

Skills are structured instruction sets (in SKILL.md format) that guide the AI agent through complex multi-step procedures. They're not just prompts — they define:

- **Steps** with explicit inputs and outputs
- **Verification criteria** — how to check the work is correct
- **Scope transparency** — what the skill does NOT cover
- **Tool permissions** — which tools the agent may use

### Built-in Skills

| Skill | When It Runs | What It Does |
|-------|-------------|--------------|
| `plan` | `/plan {goal}` | Decompose goal into dependency DAG (two-phase: draft → approve) |
| `next` | `/next` | Execute a task with context loading, guidelines, verification |
| `discover` | `/discover {topic}` | Explore options and assess risks before committing |
| `review` | `/review {task}` | 6-perspective code review |
| `onboard` | `/onboard {path}` | Import existing project knowledge into Forge |
| `deep-explore` | Auto via `/discover` | Structured option exploration with consequence tracing |
| `deep-risk` | Auto via `/discover` | 5-dimensional risk assessment with cascade analysis |
| `deep-architect` | Manual | Architecture design with 8 adversarial challenges |
| `deep-verify` | Manual | Artifact verification with impossibility pattern matching |

Skills can be created, edited, linted, and promoted via the Forge web UI or CLI. They support git sync for sharing across environments.

## Multi-Agent Support

Multiple AI agents can work on the same project in parallel:

```bash
python -m core.pipeline next myproject --agent alice
python -m core.pipeline next myproject --agent bob
```

- Two-phase claiming prevents race conditions (`CLAIMING → IN_PROGRESS`)
- `conflicts_with` on tasks prevents concurrent modification of the same files
- Each agent's changes are tracked independently

## Quick Start

```bash
# Simple task — just do it:
/do Fix the login timeout bug in auth.py

# Multi-task feature:
/plan Add Redis caching to API responses

# Existing codebase — import first, then plan:
/onboard ./my-project
/plan Add user authentication

# Full workflow for risky/complex work:
/objective Reduce API response time          # Define measurable goal
/idea Redis caching layer                    # Capture proposal
/discover I-001                              # Explore risks & options
/plan I-001                                  # Draft plan → approve → execute
/next                                        # Execute tasks one by one
/run                                         # Or execute all continuously
/compound                                    # Extract lessons when done
```

## Slash Commands Reference

| Command | Description |
|---------|-------------|
| **`/do {task}`** | Quick path — single task, start to finish |
| `/objective {title}` | Define business goal with measurable KRs |
| `/idea {title}` | Add idea to staging area |
| `/discover {topic\|idea_id}` | Explore options, assess risks |
| `/plan {goal\|idea_id}` | Decompose into task graph (draft → approve) |
| `/guideline {text}` | Add project standard |
| `/knowledge [id] [action]` | Manage domain knowledge |
| `/task {description}` | Quick-add a single task |
| `/next` | Execute next task |
| `/run [tasks]` | Continuous execution |
| `/decide` | Review and resolve open decisions |
| `/review {task_id}` | Deep code review |
| `/status` | Project dashboard |
| `/log` | Full audit trail |
| `/compound` | Extract lessons learned |
| `/onboard {path}` | Import existing project |
| `/help` | Show all commands |

## State Storage

All state lives in `forge_output/{project}/` as JSON files:

| File | Contents |
|------|----------|
| `tracker.json` | Task graph (DAG with dependencies, statuses, draft plans) |
| `decisions.json` | Decision log (standard + exploration + risk) |
| `changes.json` | File change records with reasoning traces |
| `guidelines.json` | Project standards and conventions |
| `objectives.json` | Business objectives with key results |
| `ideas.json` | Idea staging area |
| `research.json` | Structured analysis outputs |
| `knowledge.json` | Domain knowledge (versioned) |
| `lessons.json` | Cross-project learning |
| `ac_templates.json` | Reusable acceptance criteria templates |

No database. No migrations. `git diff` on the JSON files shows exactly what changed between sessions.

# Forge — Design Document

## Vision

Forge is a **structured change orchestrator** for Claude Code. It turns high-level goals into tracked, dependency-aware tasks executed step by step, with full traceability and observability.

Forge is NOT:
- A project management tool (no Gantt charts, no sprints)
- A CI/CD pipeline (no deployment logic)
- A replacement for git (git remains the source of truth for code)

Forge IS:
- An execution framework that ensures every code change is planned, tracked, reasoned about, and auditable
- A bridge between human intent and AI execution, with explicit decision points
- A system that remembers WHY things were done, not just WHAT was done

---

## Heritage from Skill_v1

The following patterns from Skill_v1 (BigQuery schema builder) proved their value and are carried forward:

### Preserved (proven patterns)

| Pattern | From Skill_v1 | In Forge |
|---------|--------------|----------|
| **Pipeline state machine** | `forge_pipeline.py` — TODO/IN_PROGRESS/DONE with subtasks | Generalized: any task graph, not just schema phases |
| **Contract-first** | `contract_utils.py` — render + validate from one dict | Verbatim copy, extended with versioning |
| **Decision log** | `forge_decisions.py` — D-NNN with accept/override/defer | Extended: tracks code decisions, not just field attributes |
| **Python/LLM boundary** | Python = I/O + validation, LLM = judgment | Same principle, but LLM also executes code changes |
| **SKILL.md format** | Reference section + Procedure section, whitelist-only commands | Same format, new domain-specific skills |
| **Gates** | Stop-the-line mechanical validation | Extended: pre-commit gates, test gates, review gates |
| **Idempotent writes** | delete-then-insert by uid | Same |
| **Reasoning traces** | Per-field `reasoning_trace` array | Per-change `reasoning_trace` — why this change, what alternatives |

### Changed (adapted for new domain)

| Skill_v1 | Forge | Why |
|----------|-------|-----|
| Entity-centric (`forge_output/v2/{entity}/`) | Project-centric (`forge_output/{project}/`) | Code changes span files, not entities |
| Fixed pipeline (P00→P04) | Dynamic task graph (user defines phases) | Different projects need different workflows |
| BigQuery-specific tools | Code-analysis + git + test tools | Different domain |
| Batch processing (fields) | Task decomposition (changes) | Unit of work is a change, not a field |

### Dropped (not applicable)

- Source discovery (S1-S4 source types) — replaced by codebase analysis
- Field resolution rules (type/mode/description) — replaced by code change rules
- BigQuery schema generation — not relevant

---

## Core Architecture

### Conceptual Model

```
User Intent (high-level goal)
    |
    v
[Plan] — decompose into tasks with dependencies
    |
    v
[Task Graph] — ordered, dependency-aware execution
    |
    v
[Skill Execution] — each task maps to a SKILL
    |
    v
[Change Record] — what changed, why, who decided
    |
    v
[Gates] — mechanical validation before proceeding
    |
    v
[Decision Points] — human review where needed
    |
    v
[Audit Trail] — full history of everything
```

### Directory Structure

```
forge/
├── core/                              # Reusable engine (domain-agnostic)
│   ├── pipeline.py                    # Task graph: init, add-tasks, next, complete, context, config
│   ├── decisions.py                   # Unified log: decisions + explorations + risks
│   ├── changes.py                     # Change records: record, diff, read, summary
│   ├── contracts.py                   # Contract render + validate (from Skill_v1)
│   ├── lessons.py                     # Compound learning: add, read, read-all
│   ├── gates.py                       # Validation gates: config, check
│   ├── guidelines.py                  # Project standards: add, read, context
│   └── ideas.py                       # Idea staging: add, read, show, update, commit
│
├── skills/                            # Pluggable skill definitions
│   ├── plan/SKILL.md                  # Decompose goal into task graph
│   ├── next/SKILL.md                  # Execute next task with full traceability
│   ├── discover/SKILL.md             # Exploration orchestrator
│   ├── review/SKILL.md               # Multi-perspective code review
│   ├── onboard/SKILL.md              # Import brownfield project
│   └── deep-*/SKILL.md               # Deep analysis skills (orchestration, explore, risk, etc.)
│
├── docs/                              # Documentation
│   ├── DESIGN.md                      # This file
│   ├── ASSUMPTIONS.md                 # Explicit assumptions and deferred decisions
│   └── STANDARDS.md                   # Standards for creating skills
│
├── .claude/                           # Claude Code integration
│   ├── CLAUDE.md                      # Agent instructions
│   ├── commands/                      # Slash commands (15+ commands)
│   └── settings.json                  # Hooks
│
└── forge_output/                      # Runtime output (gitignored)
    └── {project}/
        ├── tracker.json               # Pipeline state + config + gates
        ├── decisions.json             # Unified: decisions + explorations + risks
        ├── changes.json               # Change records
        ├── lessons.json               # Lessons learned
        ├── guidelines.json            # Project standards
        └── ideas.json                 # Idea staging area
```

### Core Concepts

#### 1. Project

A project is a scoped unit of work with a goal. It has its own tracker, decisions, and change log.

```json
{
  "project": "add-user-auth",
  "goal": "Add JWT-based authentication to the API",
  "created": "2026-03-07T10:00:00Z",
  "status": "IN_PROGRESS"
}
```

#### 2. Task

A task is a unit of work with dependencies. Tasks form a DAG (directed acyclic graph).

```json
{
  "id": "T-003",
  "name": "implement-jwt-middleware",
  "description": "Create Express middleware that validates JWT tokens",
  "depends_on": ["T-001", "T-002"],
  "skill": "skills/implement/SKILL.md",
  "status": "TODO",
  "subtasks": []
}
```

#### 3. Change Record

Every code modification is recorded with full context.

```json
{
  "id": "C-001",
  "task_id": "T-003",
  "file": "src/middleware/auth.ts",
  "action": "create",
  "summary": "JWT validation middleware with RS256 support",
  "reasoning_trace": [
    {"step": "design", "decision": "RS256 over HS256 for production key rotation"},
    {"step": "implementation", "rule": "OWASP-JWT-01", "note": "Token expiry check included"}
  ],
  "decided_by": "claude",
  "reviewed_by": null,
  "timestamp": "2026-03-07T10:15:00Z"
}
```

#### 4. Decision

A decision records a choice point — either made by the AI (needing review) or by the human.

```json
{
  "id": "D-001",
  "task_id": "T-003",
  "type": "architecture",
  "issue": "JWT signing algorithm: RS256 vs HS256",
  "recommendation": "RS256",
  "reasoning": "Allows key rotation without redeploying all services",
  "status": "OPEN",
  "decided_by": "claude",
  "confidence": "HIGH"
}
```

#### 5. Gate

Mechanical validation that must pass before proceeding.

```json
{
  "id": "G-001",
  "task_id": "T-003",
  "type": "test",
  "command": "npm test -- --testPathPattern=auth",
  "status": "PASS",
  "timestamp": "2026-03-07T10:20:00Z"
}
```

---

## Python/LLM Boundary

Same principle as Skill_v1, adapted:

| Layer | Responsibility |
|-------|---------------|
| **Python (core/)** | Read/write tracker, decisions, changes. Validate contracts. Run gates (tests, lint). Present data as Markdown. ZERO business logic. |
| **LLM (Claude Code)** | Read skills and rules. Decompose goals into tasks. Write code. Make architectural decisions. Produce structured JSON per contract. Provide reasoning traces. |

The boundary is strict:
- Python never decides WHAT to change in code
- LLM never writes directly to tracker/decisions/changes — always through Python CLI
- Python validates structure, LLM validates semantics

---

## What Makes This Different

Compared to everything in awesome-claude-code:

1. **Contract-first traceability**: No other project enforces that every LLM output is validated against a schema before persistence. This eliminates silent data corruption.

2. **Decision log with provenance**: Every decision records WHO made it (human vs AI), WHAT alternatives were considered, and WHY this choice was made. This is auditable.

3. **Change records, not just commits**: Git tells you what changed. Forge tells you WHY it changed, what task it belonged to, what decisions led to it, and what reasoning the AI applied.

4. **Validation gates**: Configured checks (test, lint, secret scan) run before task completion. Required gates report failure clearly; the skill procedure instructs the LLM to fix before completing. Gates are advisory to Python (no mechanical block on `pipeline complete`) but mandatory in the skill workflow.

5. **Resumability**: If interrupted mid-task, `forge next` picks up exactly where you left off. State is persisted after every step, not just at task completion.

---

## Future Capabilities (not in v1, but designed for)

- Multi-agent: multiple Claude instances working on different tasks in parallel
- Cross-project decisions: "we decided X in project A, apply same pattern here"
- Learning from history: analyzing past decisions to improve future recommendations
- Integration with external systems: Jira, GitHub Issues, Slack notifications
- Metrics and analytics: time per task, decision reversal rate, gate failure patterns

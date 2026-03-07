# Forge

Structured change orchestrator for Claude Code. Turns high-level goals into tracked, dependency-aware tasks with full traceability and observability.

## What Forge Does

Every code change goes through: **Plan -> Track -> Decide -> Execute -> Record -> Validate**

- **Pipeline**: Decomposes goals into a DAG of tasks with dependencies
- **Decisions**: Records every architectural/implementation choice with provenance (who, why, alternatives)
- **Changes**: Tracks every file modification with reasoning traces linked to tasks and decisions
- **Gates**: Mechanical validation (tests, lint) before proceeding

## Quick Start

```bash
# Inside Claude Code, use slash commands:
/plan Add JWT authentication to the API
/next
/status
/decide
/log
```

## Architecture

```
forge/
  core/               # Domain-agnostic engine
    pipeline.py        # Task graph orchestrator (TODO/IN_PROGRESS/DONE)
    decisions.py       # Decision log with provenance
    changes.py         # Change tracking with reasoning traces
    contracts.py       # Contract-first validation (render + validate)
  skills/              # Pluggable skill definitions (SKILL.md format)
  .claude/             # Claude Code integration
    CLAUDE.md          # Agent instructions
    commands/          # Slash commands (/plan, /next, /status, /decide, /log)
    settings.json      # Hooks
  docs/                # Design documentation
    DESIGN.md          # Architecture and decisions
    ASSUMPTIONS.md     # Explicit assumptions and deferred decisions
```

## Heritage

Core patterns evolved from Skill_v1 (BigQuery schema builder):
- **Contract-first**: One Python dict drives both the LLM prompt and validation
- **Pipeline state machine**: Resumable task execution with subtask tracking
- **Decision log**: Accept/override/defer with human vs AI provenance
- **Python/LLM boundary**: Python handles I/O + validation, LLM handles judgment

See `docs/DESIGN.md` for full architecture documentation.

## CLI Usage (standalone, without Claude Code)

```bash
# Pipeline
python -m core.pipeline init myproject --goal "Build a REST API"
python -m core.pipeline add-tasks myproject --data '[...]'
python -m core.pipeline next myproject
python -m core.pipeline complete myproject T-001
python -m core.pipeline status myproject

# Decisions
python -m core.decisions add myproject --data '[...]'
python -m core.decisions read myproject --status OPEN
python -m core.decisions update myproject --data '[...]'

# Changes
python -m core.changes record myproject --data '[...]'
python -m core.changes summary myproject
```

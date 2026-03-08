# Forge Standards

Concrete requirements for building and maintaining Forge skills and core tools.

Evolved from Skill_v1's STANDARDS.MD — same rigor, broader scope.

---

## S1. Directory Structure

```
forge/
  core/                     # Domain-agnostic engine (no SKILL.md)
    {module}.py              # Python CLI with --help via argparse
  skills/                   # Pluggable skill definitions
    {skill-name}/
      SKILL.md              # Procedure + commands (pure Markdown)
      {tool}.py             # Python CLI (optional, for skills with tools)
      contracts/            # JSON schema contracts (if structured output)
      examples/             # Few-shot examples (if structured output)
      references/           # Static reference data
  config/                   # Shared JSON configuration
```

**Core module** = Python CLI, always available, no SKILL.md.
**Skill** = LLM follows a multi-step procedure. Has SKILL.md.

---

## S2. SKILL.md Format

Same format as Skill_v1. SKILL.md is read only by the LLM — Python never parses it.

### YAML frontmatter (required)

```yaml
---
name: skill-name
id: SKILL-XXX
version: "1.0"
description: "One sentence"
---
```

### Required sections (in order)

**Reference section** (top):
1. `# {Skill Name}`
2. `## Identity` — table with ID, Version, Description
3. `## Read Commands` — table: ID, Command, Returns, When
4. `## Write Commands` — table: ID, Command, Effect, Output, When, Contract
5. `## Output` — table with File, Contains
6. `## Success Criteria` — bullet list
7. `## References` — file paths

`---` separator

**Procedure section** (bottom):
8. `## Overview` — one paragraph
9. `## Prerequisites`
10. `## Step 1 — {Name}` through `## Step N`
11. `## Error Handling` — table
12. `## Resumability`

### Rules

- **Whitelist-only**: steps may ONLY invoke commands from Read/Write tables
- Steps say "read file X" explicitly — no implicit context loading
- Reference section separated from procedure by `---`

### S2.1 Adapted Skills (deep-* skills)

Skills adapted from external sources (e.g., [Deep-Process](https://github.com/Deep-Process/deep-process)) follow a lighter format to preserve upstream compatibility while meeting Forge minimums.

**Required:**
- YAML frontmatter with `name`, `id` (SKILL-DEEP-{NAME}), `version`, `description`
- Provenance header: `> **Provenance**: Adapted from [source](url) {skill} v{version}.`
- Forge Integration section: how findings map to Forge decisions/lessons
- Multi-step procedure (Steps)

**Not required** (differs from native S2):
- Identity table, Read/Write Commands tables, Output table, Success Criteria
- Prerequisites, Error Handling, Resumability sections

**Rationale:** Deep-* skills are analysis methodology guides, not Forge I/O procedures. They don't invoke Python CLIs directly — the `/discover` skill (which IS native S2) bridges between Forge and deep-* analysis. Forcing full S2 format on methodology guides would add noise without improving traceability.

**Update policy:** Compare `version` in frontmatter against upstream repo. When updating, preserve `id` and Forge Integration section.

---

## S3. Python CLI Standard

### Structure
- `argparse` with subcommands
- Project as first positional argument
- Structured input: `--data '{json}'`

### Output
- **Read commands are pure** — return data, MUST NOT modify files
- **Write commands have side effects** — modify files, only way to change state
- Read commands output Markdown for LLM consumption
- Write commands output confirmation + next step hint
- Errors to stderr + exit code 1
- **Every command must be re-runnable** (idempotent)

### Required
- Windows UTF-8 workaround at module top
- `--help` via argparse

---

## S4. Contract-First Policy

Same as Skill_v1 — one Python dict drives both rendering and validation.

- `render_contract(name, spec)` -> Markdown for LLM
- `validate_contract(spec, data)` -> list of errors

Every write command accepting LLM-produced JSON MUST have a contract.
Every SKILL.md write command MUST declare `contract:` with the Python command.

---

## S5. Traceability Requirements

### Change records
Every file modification MUST be recorded via `core.changes record` with:
- `task_id` linking to the pipeline task
- `reasoning_trace` explaining WHY the change was made
- `decision_ids` linking to relevant decisions

### Decisions
Every non-trivial choice MUST be recorded via `core.decisions add` with:
- `type` classifying the decision
- `reasoning` explaining the rationale
- `alternatives` listing what was considered
- `confidence` level

### Audit trail invariant
- **Reset does NOT delete** decisions or changes — audit trail is append-only
- Deleted/rolled-back changes get a new change record with action="revert"

---

## S6. Review Checklist

When modifying Forge:

**Core:**
- [ ] `argparse` subcommands, `--help` works
- [ ] Windows UTF-8 block present
- [ ] Writes are idempotent
- [ ] Errors go to stderr + exit(1)

**Skills:**
- [ ] SKILL.md has YAML frontmatter
- [ ] Write commands have contracts
- [ ] Steps use ONLY commands from Read/Write tables
- [ ] Examples exist if LLM produces structured output

**Traceability:**
- [ ] Changes recorded for file modifications
- [ ] Decisions recorded for non-trivial choices
- [ ] reasoning_trace present in changes

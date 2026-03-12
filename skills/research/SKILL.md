---
name: research
id: SKILL-RESEARCH
version: "1.0"
description: "Manage R-NNN research objects — structured analysis summaries linked to objectives, ideas, and decisions."
---

# Research

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-RESEARCH |
| Version | 1.0 |
| Description | Manage research objects (R-NNN) that capture structured summaries of discovery/analysis work, linked to objectives, ideas, and decisions. |

## Read Commands

| ID | Command | Returns | When |
|----|---------|---------|------|
| R1 | `python -m core.research read {project} [--status X] [--category X] [--entity X]` | List/filter research objects | List, filter |
| R2 | `python -m core.research show {project} {research_id}` | Full research details + linked decisions | Show details |
| R3 | `python -m core.research context {project} --entity {O-NNN\|I-NNN}` | Research context for an entity | Context loading |
| R4 | `python -m core.research contract {name}` | Contract spec (add, update) | Before add/update |

## Write Commands

| ID | Command | Effect | When | Contract |
|----|---------|--------|------|----------|
| W1 | `python -m core.research add {project} --data '{json}'` | Creates R-NNN research objects | Add research | `research:add` |
| W2 | `python -m core.research update {project} --data '{json}'` | Updates status, findings, decision links | Update research | `research:update` |

## Output

| File | Contains |
|------|----------|
| `forge_output/{project}/research.json` | Structured research objects (R-NNN) |

## Success Criteria

- Research objects have clear title, topic, category, and summary
- Linked to relevant entity (objective or idea) when applicable
- Key findings captured as bullet points
- Decision IDs linked for bidirectional traceability

---

## Overview

Research objects are structured summaries of analysis work. They link full research files
(`forge_output/{project}/research/*.md`) to objectives, ideas, and decisions. Created
primarily by `/discover`, but can also be managed directly via `/research`.

Categories: `architecture`, `domain`, `feasibility`, `risk`, `business`, `technical`

Status lifecycle: `DRAFT` → `ACTIVE` → `SUPERSEDED` | `ARCHIVED`

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| (none) | List all research | `/research` |
| `{id}` | Show details | `/research R-001` |
| `add {title}` | Add new research interactively | `/research add Caching analysis` |
| `{id} update` | Update a research object | `/research R-001 update` |
| `context {entity}` | Load research context for entity | `/research context O-001` |
| `list [filters]` | List with filters | `/research list --status ACTIVE` |

---

### Step 1 — Determine Project

```bash
ls forge_output/ 2>/dev/null
```

If no project exists, inform the user and stop — research requires an active project.

```bash
python -m core.pipeline status {project}
```

---

### Step 2 — Route by Argument

Parse the user's argument to determine the action:

| Pattern | Action | Go to |
|---------|--------|-------|
| (none) or `list` | List research objects | Step 3 |
| `R-NNN` (ID only) | Show details | Step 4 |
| `add {title}` | Add new research | Step 5 |
| `R-NNN update` | Update research | Step 6 |
| `context {entity}` | Load entity context | Step 7 |

---

### Step 3 — List Research

```bash
python -m core.research read {project}
```

With optional filters:
```bash
python -m core.research read {project} --status ACTIVE
python -m core.research read {project} --category architecture
python -m core.research read {project} --entity O-001
```

Present the results as a table. If no research exists, suggest:
- `/discover {topic}` to create research through structured analysis
- `/research add {title}` to add research manually

---

### Step 4 — Show Research Details

```bash
python -m core.research show {project} {research_id}
```

Displays: title, topic, category, status, linked entity, summary, key findings,
related decisions, file path, scopes, tags, timestamps.

If the research has a `file_path`, mention it so the user can read the full analysis.

---

### Step 5 — Add Research

**a. Align** — confirm what the user wants to research:

"You want to add research about {title}. Let me gather the details."

**b. Check contract:**
```bash
python -m core.research contract add
```

**c. Ask for required fields** (skip what can be inferred from context):
- **topic**: What question is being researched?
- **category**: architecture, domain, feasibility, risk, business, or technical?
- **summary**: 1-3 sentence summary of findings
- **linked entity**: Is this linked to an objective (O-NNN) or idea (I-NNN)?

**d. Create the research object:**
```bash
python -m core.research add {project} --data '[{
  "title": "{title}",
  "topic": "{question being researched}",
  "category": "{category}",
  "summary": "{summary of findings}",
  "linked_entity_type": "{objective|idea}",
  "linked_entity_id": "{O-NNN|I-NNN}",
  "key_findings": ["{finding 1}", "{finding 2}"],
  "scopes": ["{relevant scopes}"],
  "tags": ["{keywords}"]
}]'
```

**e. Present** the created research and suggest next steps:
- `/research R-NNN` to view details
- `/discover {topic}` for deeper structured analysis
- Update status to ACTIVE when findings are confirmed

---

### Step 6 — Update Research

**a. Show current state:**
```bash
python -m core.research show {project} {research_id}
```

**b. Ask what to update:**
- Status change (DRAFT → ACTIVE, ACTIVE → SUPERSEDED/ARCHIVED)
- Add/update key findings
- Link decision IDs
- Update summary

**c. Apply update:**
```bash
python -m core.research update {project} --data '[{
  "id": "{research_id}",
  "status": "{new_status}",
  "key_findings": ["{updated findings}"],
  "decision_ids": ["{D-NNN}"]
}]'
```

---

### Step 7 — Context Loading

Load all active research linked to an entity:

```bash
python -m core.research context {project} --entity {entity_id}
```

This resolves research by:
1. Direct match: `linked_entity_id == entity_id`
2. Secondary match: `linked_idea_id == entity_id`
3. Indirect (for objectives): ideas advancing the objective's KRs → research linked to those ideas

Present the context summary. This is used by `/plan` and `/next` to load research context into task execution.

---

## Error Handling

| Error | Action |
|-------|--------|
| No project exists | Tell user to create one first (`/plan` or `pipeline init`) |
| Research ID not found | Show available research objects |
| Invalid status transition | Show valid transitions for current status |
| Duplicate research (same category + title) | Inform user, suggest updating existing |

## References

- `core/research.py` — Research module implementation
- `skills/discover/SKILL.md` — Primary producer of research objects
- `docs/DESIGN.md` — Architecture overview

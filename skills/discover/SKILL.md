---
name: discover
id: SKILL-DISCOVER
version: "1.0"
description: "Discovery phase — explore options, assess feasibility, analyze risks, and design architecture before planning."
---

# Discover

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-DISCOVER |
| Version | 1.0 |
| Description | Orchestrate deep-* analysis skills to explore what to build, assess risks, and prepare architecture before committing to a plan. |

## Read Commands

| ID | Command / Path | Returns | When |
|----|----------------|---------|------|
| R1 | `skills/deep-orchestration/SKILL.md` | Orchestration procedure | Step 1 — resolve orchestrator |
| R2 | `skills/deep-explore/SKILL.md` | Exploration procedure | Step 2 — resolve skills |
| R3 | `skills/deep-risk/SKILL.md` | Risk analysis procedure | Step 2 |
| R4 | `skills/deep-architect/SKILL.md` | Architecture procedure | Step 2 |
| R5 | `skills/deep-feasibility/SKILL.md` | Feasibility procedure | Step 2 |
| R6 | `skills/deep-requirements/SKILL.md` | Requirements procedure | Step 2 (optional) |
| R7 | `python -m core.lessons read-all` | Lessons from past projects | Step 3 — context |
| R8 | `python -m core.decisions read {project} --status OPEN` | Open decisions (if project exists) | Step 3 — context |
| R9 | `ls forge_output/ 2>/dev/null` | Existing projects | Step 3 — context |

## Write Commands

| ID | Command | Effect | When | Contract |
|----|---------|--------|------|----------|
| W1 | `python -m core.decisions add {project} --data '{json}'` | Records discovery findings as decisions | Step 5 — after analysis | `decisions:add` |
| W2 | `python -m core.lessons add {project} --data '{json}'` | Records discovery insights as lessons | Step 5 — significant learnings | `lessons:add` |

## Output

| File | Contains | Written by |
|------|----------|------------|
| `forge_output/{project}/decisions.json` | Discovery findings as OPEN decisions (architecture, risk, feasibility) | W1 |
| `forge_output/{project}/lessons.json` | Discovery insights (if significant) | W2 |

## Success Criteria

- deep-orchestration was used to coordinate analysis skills (not ad-hoc)
- At least deep-explore + one other skill (risk, feasibility, or architect) completed
- Findings recorded as OPEN decisions with clear recommendations
- User has enough information to make a GO / NO-GO decision
- If GO: output is ready to feed into `/plan`

## References

- `docs/DESIGN.md` — Architecture overview
- `docs/STANDARDS.md` — Skill standards
- External: deep-orchestration, deep-explore, deep-risk, deep-architect, deep-feasibility SKILLs

---

## Overview

Discovery is the phase BEFORE planning. It answers: "What should we build, is it feasible, what are the risks, and how should we architect it?" — using deep-* analysis skills coordinated by deep-orchestration.

This skill is the bridge between Forge (execution engine) and deep-process-skill (analysis engine). Forge provides project context; deep-orchestration coordinates analysis; Forge records the results.

## Prerequisites

- User has a topic, question, or proposed direction to explore
- If exploring within an existing project: project exists in forge_output/

Note: All required deep-* analysis skills are built into Forge under `skills/deep-*`.
Provenance: [Deep-Process](https://github.com/Deep-Process/deep-process).

---

### Step 1 — Resolve the Orchestrator

Read `skills/deep-orchestration/SKILL.md` — this is the conductor that coordinates analysis skills.

---

### Step 2 — Determine Discovery Scope

Based on the user's input (or explicit flags), determine which analysis skills are needed:

| User intent / flag | Required skills | Optional |
|--------------------|----------------|----------|
| "What should we do?" (open exploration) | deep-explore | deep-feasibility, deep-risk |
| "Should we do X?" (evaluating a proposal) | deep-explore, deep-feasibility | deep-risk |
| "How should we build X?" (design question) | deep-explore, deep-architect | deep-requirements |
| "Is X risky?" / `--risk-only` | deep-risk | deep-explore, deep-feasibility |
| "Full analysis" / `--full` | deep-explore, deep-feasibility, deep-risk, deep-architect | deep-requirements |

Read each needed skill from `skills/deep-{name}/SKILL.md` and its `references/` directory (if present).

---

### Step 3 — Gather Forge Context

Before running analysis, gather project context to feed into the deep-* skills:

**If a project exists:**
```bash
python -m core.pipeline status {project}
python -m core.decisions read {project} --status OPEN
python -m core.lessons read-all
```

**If no project yet:**
```bash
python -m core.lessons read-all
```

Also read the codebase if it's a brownfield project:
- Directory structure
- Key config files
- Existing architecture patterns

Compile this as context input for the orchestrator.

---

### Step 4 — Execute via deep-orchestration

Follow the deep-orchestration SKILL.md procedure:

1. **Define** — subject is the user's discovery topic, with Forge context gathered in Step 3
2. **Sequence** — build the dependency graph for selected skills:

```
Typical discovery flow:
  deep-explore ──→ deep-feasibility ──→ deep-risk
                                    └──→ deep-architect
```

Skills that can run in parallel (no output dependencies):
- deep-risk and deep-architect can run concurrently AFTER deep-explore
- deep-feasibility can run in parallel with deep-risk if both only need explore output

Skills that must be sequential:
- deep-explore FIRST (provides option map for all others)
- deep-feasibility after deep-explore (needs options to evaluate)

3. **Execute** — run each skill per its SKILL.md procedure
4. **Aggregate** — combine outputs per deep-orchestration Step 4

Track execution:

| Step | Skill | Status | Key Output |
|------|-------|--------|------------|
| 1 | deep-explore | pending | Option map, knowledge audit |
| 2 | deep-feasibility | pending | GO/CONDITIONAL/NO-GO verdict |
| 3 | deep-risk | pending | Risk register, top risks |
| 4 | deep-architect | pending | Components, ADRs, C4 diagrams |

---

### Step 5 — Record Findings in Forge

After orchestration completes, translate findings into Forge decisions:

**From deep-explore:**
- Each significant option → OPEN decision with `type: "architecture"`, `decided_by: "claude"`, `confidence: "MEDIUM"`
- Recommended path → decision with recommendation and alternatives

**From deep-feasibility:**
- Binding constraints → OPEN decision with `type: "constraint"`, highlight blocker
- CONDITIONAL GO conditions → OPEN decisions that need resolution

**From deep-risk:**
- Top 3-5 risks → OPEN decisions with `type: "security"` or `type: "architecture"`
- Each mitigation → part of the recommendation

**From deep-architect:**
- ADRs → OPEN decisions with `type: "architecture"`, full alternatives and tradeoffs
- Component boundaries → decision context for future tasks

If no project exists yet, create one with a slug derived from the topic:
```bash
python -m core.pipeline init {slug} --goal "Discovery: {topic}"
```

Determine the `task_id` for recording findings:
- If discovering for a **specific idea** (e.g., `/discover I-001`): use the idea ID as task_id (`"I-001"`). This links decisions to the idea, visible in `ideas show`.
- If discovering a **general topic** (no idea): use `"DISCOVERY"` as task_id.

```bash
python -m core.decisions add {project} --data '[
  {
    "task_id": "{idea_id or DISCOVERY}",
    "type": "architecture",
    "issue": "{finding from deep-explore}",
    "recommendation": "{recommended option}",
    "reasoning": "{from analysis}",
    "alternatives": ["{option B}", "{option C}"],
    "confidence": "MEDIUM",
    "decided_by": "claude",
    "status": "OPEN"
  }
]'
```

If significant insights emerged, record as lessons:
```bash
python -m core.lessons add {project} --data '[{
  "category": "pattern-discovered",
  "title": "{key insight}",
  "detail": "{why this matters}",
  "task_id": "DISCOVERY",
  "severity": "important",
  "applies_to": "{when this lesson is relevant}",
  "tags": ["discovery", "{topic}"]
}]'
```

---

### Step 6 — Present Discovery Brief

Present the combined findings to the user:

```
## Discovery Brief: {topic}

### Orchestration Summary
| Skill | Status | Key Finding |
|-------|--------|-------------|
| deep-explore | done | {1-line summary} |
| deep-feasibility | done | {GO/CONDITIONAL/NO-GO} |
| deep-risk | done | {top risk + score} |
| deep-architect | done | {key ADR} |

### Recommended Direction
{1-2 paragraphs: what to build and why, informed by all analyses}

### Open Decisions ({N} recorded)
{List OPEN decisions requiring user input before /plan}

### Risks to Accept
{Top 3 risks with proposed mitigations}

### Next Steps
- [ ] Review and close OPEN decisions with `/decide`
- [ ] When ready: `/plan {recommended goal}`
- [ ] Or: request deeper analysis on specific aspect
```

Wait for user response. Offer:
- `/decide` to resolve open decisions
- `/plan {goal}` to proceed to execution
- Another `/discover` on a sub-topic for deeper analysis

---

## Error Handling

| Error | Action |
|-------|--------|
| A built-in deep-* SKILL.md missing | Check `skills/` directory. If missing, re-clone Forge. |
| deep-feasibility returns NO-GO | **PAUSE** — present to user. Do NOT proceed to /plan. Ask if they want to explore alternatives. |
| deep-risk finds CRITICAL risk | **FLAG prominently** — but continue analysis. User decides. |
| No project exists yet | Use `task_id: "DISCOVERY"` for all decisions. Create project when user moves to `/plan`. |

## Resumability

- If interrupted: decisions already recorded are persisted (append-only)
- Re-running `/discover` on same topic: analyses will re-run (no state tracks which skills completed), but existing decisions are preserved (dedup by task_id + type + issue)
- Discovery findings persist regardless of whether `/plan` follows

## Integration with Forge Pipeline

`/discover` sits BEFORE `/plan` in the Forge lifecycle:

```
/discover {topic}     ← NEW: explore, assess, design
    ↓
/decide               ← resolve OPEN discovery decisions
    ↓
/plan {goal}          ← decompose into tasks (informed by discovery)
    ↓
/next or /run         ← execute
    ↓
/compound             ← learn
```

Discovery decisions with `task_id: "DISCOVERY"` are visible in `/plan` context, informing task decomposition. Tasks can reference discovery decisions via `blocked_by_decisions`.

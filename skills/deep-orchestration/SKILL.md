---
name: deep-orchestration
id: SKILL-DEEP-ORCHESTRATION
description: >
  Use when user needs to run multiple deep-* analyses in a coordinated
  workflow. Triggers: "full analysis", "run everything", "complete assessment",
  "end-to-end analysis", "orchestrate the deep processes".
version: "1.0.0"
allowed-tools: [Read, Glob, Grep]
---

> **Provenance**: Adapted from [Deep-Process](https://github.com/Deep-Process/deep-process) `deep-orchestration` v1.0.0.
> Forge integration: findings recorded as Forge decisions/lessons. See Forge Integration section below.

# Deep Orchestration

Workflow coordination — running multiple deep-* skills in sequence.

## Procedure

### Step 1 — Define

Determine workflow scope:

- What is the subject of analysis?
- What decisions need to be made?
- What skills are relevant?
- What inputs are available?

### Step 2 — Sequence

Build dependency graph. Select from recommended flows or compose custom:

**Decision flow:**
1. deep-explore — understand the landscape
2. deep-feasibility — assess viability of options
3. deep-risk — identify risks for viable options
4. deep-aggregate — combine into decision brief

**Build flow:**
1. deep-requirements — capture what to build
2. deep-architect — design the solution
3. deep-implement — build it
4. deep-test — verify it works
5. deep-deploy — ship it

**Validation flow:**
1. deep-verify — check artifact correctness
2. deep-challenge — stress-test conclusions
3. deep-aggregate — combine findings

**Custom flow:**
- List skills in execution order
- Mark dependencies: which skill needs output from which
- Identify parallel opportunities (skills with no mutual dependencies)

### Step 3 — Execute

Run skills in order:

- Before each skill: confirm inputs are available
- After each skill: capture output for downstream use
- If a skill produces a blocking finding (e.g., feasibility = NO), pause and confirm whether to continue
- Track execution status:

| Step | Skill | Status | Key Output |
|------|-------|--------|------------|
| 1 | ... | done/running/pending/skipped | ... |

### Step 4 — Aggregate

After all skills complete, invoke deep-aggregate to combine outputs:

- Decision brief with all findings
- Cross-references between skill outputs
- Conflicts between skill findings flagged
- Final recommendations

Output:

```
## Orchestration Summary — [Subject] — [Date]

### Flow Executed: [Decision / Build / Validation / Custom]

### Execution Log
| Step | Skill | Status | Duration | Key Finding |
|------|-------|--------|----------|-------------|

### Combined Findings
...

### Cross-Skill Conflicts
...

### Final Recommendations
1. ...
2. ...
```

## Checklist

- [ ] Flow type selected and justified
- [ ] Dependency graph defined before execution
- [ ] Each skill received correct inputs
- [ ] Blocking findings handled (pause/continue decisions logged)
- [ ] Outputs aggregated with cross-references
- [ ] Conflicts between skill outputs flagged

---

## Forge Integration

When running inside Forge pipeline:

- **Record findings as decisions**: Use `python -m core.decisions add {project} --data '[...]'` with appropriate `task_id`
- **Record insights as lessons**: Use `python -m core.lessons add {project} --data '[...]'` for cross-project learning
- **Check context first**: Run `python -m core.lessons read-all` for relevant past learnings
- **Provenance**: All decisions from this skill use `decided_by: "claude"` with the skill name in `scope` field
- **Update source**: https://github.com/Deep-Process/deep-process

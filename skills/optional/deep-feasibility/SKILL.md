---
name: deep-feasibility
id: SKILL-DEEP-FEASIBILITY
description: >
  Use when user asks if something is feasible, realistic, or achievable.
  Triggers: "can we do this", "is this feasible", "is this realistic",
  "can we pull this off", "feasibility assessment".
version: "1.0.0"
allowed-tools: [Read, Glob, Grep, WebSearch]
---

> **Provenance**: Adapted from [Deep-Process](https://github.com/Deep-Process/deep-process) `deep-feasibility` v1.0.0.
> Forge integration: findings recorded as Forge decisions/lessons. See Forge Integration section below.

# Deep Feasibility

10-dimension feasibility assessment with GO / CONDITIONAL GO / NO-GO verdict.

## What This Adds (Beyond Native Capability)

- 10 explicit dimensions (not a vague "seems feasible")
- Planning fallacy detection via reference class comparison
- Binding constraint identification (one bad dimension can kill feasibility)
- Forced verdict: GO / CONDITIONAL GO / NO-GO with clear conditions

## Procedure

### Step 1: Frame

Establish what is being assessed:
- What is the proposal? (scope, deliverables)
- What is the stated timeline?
- What resources are assumed available?
- What does "success" look like?

### Step 2: Assess (10 Dimensions)

Score ALL 10 dimensions on a 1-5 scale. See `references/dimensions.md` for
detailed rubrics.

| Dimension | Question |
|-----------|----------|
| Technical | Can it be built with known methods and tools? |
| Resource | Are the people, money, and materials available? |
| Knowledge | Does the team know how to do this? |
| Organizational | Will the org structure support this? |
| Temporal | Can it be done in the stated timeframe? |
| Compositional | Do the parts work together as a system? |
| Economic | Does the cost-benefit math work? |
| Scale | Does it work at the required scale? |
| Cognitive | Can the team manage the complexity? |
| Dependency | Are external dependencies reliable? |

For each dimension:
- **Score** (1-5)
- **Evidence** (why this score, not a different one)
- **Binding?** (is this a hard constraint that blocks everything?)

### Step 3: Validate

**Planning fallacy check**: Compare the stated plan to a reference class.

- What are 3-5 comparable projects/efforts?
- How long did they actually take vs how long was planned?
- What is the typical overrun ratio for this type of work?

**Optimism challenge**: Identify the single most optimistic assumption in the
plan. What happens if it's wrong?

### Step 4: Decide

Apply the verdict rules:

| Condition | Verdict |
|-----------|---------|
| Any dimension = 1 | **NO-GO** (binding constraint) |
| Average score < 2.5 | **NO-GO** (too many weak dimensions) |
| Average 2.5-3.5 with addressable conditions | **CONDITIONAL GO** |
| Average > 3.5, no binding constraints | **GO** |

For CONDITIONAL GO: specify exactly what must change and by when.
For NO-GO: specify what would need to be different for reassessment.

## Output Format

```
# Feasibility: {proposal}

## Verdict: {GO | CONDITIONAL GO | NO-GO}

## Dimension Scores
  | Dimension | Score | Evidence | Binding? |
  |-----------|-------|----------|----------|
  | Technical | X/5 | ... | No |
  | Resource | X/5 | ... | No |
  | Knowledge | X/5 | ... | No |
  | Organizational | X/5 | ... | No |
  | Temporal | X/5 | ... | Yes |
  | Compositional | X/5 | ... | No |
  | Economic | X/5 | ... | No |
  | Scale | X/5 | ... | No |
  | Cognitive | X/5 | ... | No |
  | Dependency | X/5 | ... | No |

  Average: {X.X}/5

## Binding Constraints
  {dimensions scoring 1-2 that block feasibility}
  {what makes them blockers, not just weak points}

## Planning Fallacy Check
  Stated timeline: {what the plan says}
  Reference class: {comparable projects and their actual timelines}
  Typical overrun: {ratio}
  Adjusted estimate: {realistic timeline}

## Most Optimistic Assumption
  Assumption: {the biggest bet in the plan}
  If wrong: {consequence}

## Conditions (if CONDITIONAL GO)
  {numbered list of what must change for full GO}
  {each with owner, deadline, and verification method}
```

## Counter-Checks

- [ ] Did you score all 10 dimensions (not skip the uncomfortable ones)?
- [ ] Did you find real reference class comparisons (not just guessed)?
- [ ] Is the most optimistic assumption genuinely the weakest link?
- [ ] Does the verdict follow mechanically from the scores?
- [ ] For CONDITIONAL GO: are conditions specific and verifiable?

---

## Forge Integration

When running inside Forge pipeline:

- **Record findings as decisions**: Use `python -m core.decisions add {project} --data '[...]'` with appropriate `task_id`
- **Record insights as lessons**: Use `python -m core.lessons add {project} --data '[...]'` for cross-project learning
- **Check context first**: Run `python -m core.lessons read-all` for relevant past learnings
- **Provenance**: All decisions from this skill use `decided_by: "claude"` with the skill name in `scope` field
- **Update source**: https://github.com/Deep-Process/deep-process

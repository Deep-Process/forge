---
name: next
id: SKILL-NEXT
version: "1.0"
description: "Get the next task from the pipeline and execute it with full traceability."
---

# Next (Execute Task)

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-NEXT |
| Version | 1.0 |
| Description | Pick the next available task, gather context, execute, validate, record. |

## Read Commands

| ID | Command | Returns | When |
|----|---------|---------|------|
| R1 | `python -m core.pipeline next {project}` | Next available task | Step 1 — get task |
| R2 | `python -m core.pipeline context {project} {task_id}` | Context from dependency tasks | Step 2 — before execution |
| R3 | `python -m core.decisions read {project} --task {task_id}` | Existing decisions for this task | Step 2 — check prior decisions |
| R4 | `python -m core.decisions contract add` | Contract for recording decisions | Before recording |
| R5 | `python -m core.changes contract` | Contract for recording changes | Before recording |
| R6 | `python -m core.gates show {project}` | Configured validation gates | Step 5 — before validation |

## Write Commands

| ID | Command | Effect | When |
|----|---------|--------|------|
| W1 | `python -m core.decisions add {project} --data '{json}'` | Records decisions | Step 3 — for significant choices |
| W2 | `python -m core.changes record {project} --data '{json}'` | Records file changes | Step 4 — after code changes |
| W3 | `python -m core.gates check {project} --task {task_id}` | Runs validation gates | Step 5 — before completion |
| W4 | `python -m core.git_ops commit {project} {task_id} -m "..."` | Commits with metadata | Step 5 — after validation |
| W5 | `python -m core.pipeline complete {project} {task_id}` | Marks task DONE | Step 6 — after all validation |
| W6 | `python -m core.pipeline fail {project} {task_id} --reason "..."` | Marks task FAILED | On failure |

## Output

| File | Contains |
|------|----------|
| `forge_output/{project}/tracker.json` | Updated task statuses |
| `forge_output/{project}/decisions.json` | New decisions (if any) |
| `forge_output/{project}/changes.json` | Recorded file changes |

## Success Criteria

- Task instruction fully executed
- All significant decisions recorded with reasoning
- All file changes recorded with reasoning_trace
- Validation gates pass (or failures explicitly acknowledged)
- Task marked DONE only after validation

---

## Overview

Execute the next available task from the pipeline with full traceability.
Every code change is recorded, every decision is logged, and validation
gates must pass before completion.

## Prerequisites

- A project exists with tasks in the pipeline
- At least one task is TODO with all dependencies met

---

### Step 1 — Get the Task

```bash
python -m core.pipeline next {project}
```

If no task is available:
- All done → show final status, suggest `/compound`
- Blocked by failed task → show failure, suggest fix and reset
- No tasks → tell user to run `/plan`

If a SKILL path is specified on the task, read that SKILL.md and follow
its procedure instead of this generic flow.

---

### Step 2 — Gather Context

Before writing any code, understand the full context:

a. **Read context from dependencies** (what previous tasks produced):
```bash
python -m core.pipeline context {project} {task_id}
```

b. **Check existing decisions** for this task:
```bash
python -m core.decisions read {project} --task {task_id}
```

c. **Read the codebase** — understand files you'll modify:
   - Read the task instruction carefully
   - Open and read every file mentioned in the instruction
   - Understand the existing code patterns before changing anything

d. **Check open decisions** that might affect this task:
```bash
python -m core.decisions read {project} --status OPEN
```

---

### Step 3 — Execute with Decisions

Implement the task following its instruction.

For every significant choice during implementation, record a decision:

```bash
python -m core.decisions contract add
```

Then:
```bash
python -m core.decisions add {project} --data '[{
  "task_id": "{task_id}",
  "type": "implementation",
  "issue": "...",
  "recommendation": "...",
  "reasoning": "...",
  "alternatives": ["..."],
  "confidence": "HIGH|MEDIUM|LOW",
  "decided_by": "claude"
}]'
```

**What counts as a significant decision:**
- Choosing between two valid approaches
- Deviating from the task instruction
- Adding something not explicitly requested
- Security-relevant choices
- Performance trade-offs

**What does NOT need a decision:**
- Following the only obvious path
- Standard library usage
- Formatting/style (follow existing patterns)

---

### Step 4 — Record Changes

After making code changes, use `changes diff` to auto-detect:

```bash
python -m core.changes diff {project} {task_id}
```

Review the suggested records, enrich with `reasoning_trace` and
`decision_ids`, then record:

```bash
python -m core.changes record {project} --data '[{
  "task_id": "{task_id}",
  "file": "path/to/file",
  "action": "create|edit|delete",
  "summary": "What was changed",
  "reasoning_trace": [
    {"step": "design", "detail": "Why this approach"},
    {"step": "implementation", "detail": "How it works"}
  ],
  "decision_ids": ["D-001"],
  "lines_added": N,
  "lines_removed": N
}]'
```

**Every file you create, edit, or delete must have a change record.**

---

### Step 5 — Validate

Run configured validation gates:

```bash
python -m core.gates check {project} --task {task_id}
```

If gates fail:
- **Required gate fails**: Fix the issue, re-record changes, re-run gates
- **Advisory gate fails**: Note the failure, proceed if acceptable
- **No gates configured**: Skip (but warn)

If git is available and validation passes, commit:

```bash
python -m core.git_ops commit {project} {task_id} -m "descriptive message"
```

---

### Step 6 — Complete

Mark the task as DONE:

```bash
python -m core.pipeline complete {project} {task_id}
```

Then immediately proceed to the next task (loop back to Step 1).

---

### On Failure

If the task cannot be completed:

1. Record what was attempted and why it failed
2. Mark the task as FAILED with a clear reason:
```bash
python -m core.pipeline fail {project} {task_id} --reason "Clear description of what failed"
```
3. Do NOT silently stop — always mark the failure

If a task is too large, break it into subtasks:
```bash
python -m core.pipeline register-subtasks {project} {task_id} --data '[...]'
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No tasks available | Show status, suggest `/plan` |
| Dependencies not met | Show blocking tasks |
| Gate fails | Fix issue, retry gates |
| Task too large | Register subtasks |
| Unclear instruction | Create OPEN decision asking user for clarification |

## Resumability

- If interrupted, the task remains IN_PROGRESS — `next` will resume it
- Decisions and changes are persisted incrementally
- Gate results are stored on the task
- Git commits preserve state even if pipeline tracking fails

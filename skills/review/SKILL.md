---
name: review
id: SKILL-REVIEW
version: "1.0"
description: "Structured code review of task changes before completion."
---

# Review

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-REVIEW |
| Version | 1.0 |
| Description | Review changes made during a task for correctness, security, and quality. |

## Read Commands

| ID | Command | Returns | When |
|----|---------|---------|------|
| R1 | `python -m core.changes read {project} --task {task_id}` | Changes made in this task | Step 1 — understand scope |
| R2 | `python -m core.decisions read {project} --task {task_id}` | Decisions made in this task | Step 1 — understand reasoning |
| R3 | `python -m core.pipeline status {project}` | Pipeline state | Step 1 — context |
| R4 | `python -m core.gates show {project}` | Configured gates | Step 3 — validation |

## Write Commands

| ID | Command | Effect | When |
|----|---------|--------|------|
| W1 | `python -m core.decisions add {project} --data '{json}'` | Records review findings | Step 2 — for issues found |
| W2 | `python -m core.gates check {project} --task {task_id}` | Runs validation | Step 3 — automated checks |
| W3 | `python -m core.lessons add {project} --data '{json}'` | Records review lessons | Step 4 — patterns found |

## Output

| File | Contains |
|------|----------|
| `forge_output/{project}/decisions.json` | Review findings as decisions |
| `forge_output/{project}/lessons.json` | Patterns discovered during review |

## Success Criteria

- Every changed file has been read and reviewed
- Security concerns identified and recorded
- Decisions validated against their reasoning
- Gate checks pass
- No OPEN decisions left unaddressed

---

## Overview

Structured review of changes made during task execution. The review
examines correctness, security, consistency, and whether decisions
were properly justified.

## Prerequisites

- A task has been executed (changes exist)
- The task is IN_PROGRESS or DONE

---

### Step 1 — Understand Scope

Read what was changed and why:

```bash
python -m core.changes read {project} --task {task_id}
```

```bash
python -m core.decisions read {project} --task {task_id}
```

For each changed file, read the actual file to see the current state.

---

### Step 2 — Review Checklist

Go through each changed file and check:

**Correctness**
- Does the code do what the task instruction asked?
- Are edge cases handled?
- Do the changes break any existing functionality?

**Security (OWASP-aware)**
- Input validation: is user input sanitized?
- Injection: SQL, command, XSS vectors?
- Authentication/Authorization: proper checks?
- Secrets: no hardcoded credentials, keys, tokens?
- Dependencies: known vulnerabilities?

**Consistency**
- Does the code follow existing patterns in the codebase?
- Naming conventions maintained?
- Error handling consistent?

**Decisions**
- Does each decision have valid reasoning?
- Were alternatives properly considered?
- Any LOW confidence decisions that need escalation?

For each issue found, record a decision:

```bash
python -m core.decisions add {project} --data '[{
  "task_id": "{task_id}",
  "type": "security|implementation|architecture",
  "issue": "Review finding: ...",
  "recommendation": "Fix: ...",
  "reasoning": "Why this matters: ...",
  "confidence": "HIGH",
  "status": "OPEN",
  "decided_by": "claude"
}]'
```

---

### Step 3 — Run Automated Checks

```bash
python -m core.gates check {project} --task {task_id}
```

If gates fail, record findings as OPEN decisions.

---

### Step 4 — Extract Patterns

If the review reveals reusable patterns or common mistakes:

```bash
python -m core.lessons add {project} --data '[{
  "category": "pattern-discovered|mistake-avoided",
  "title": "...",
  "detail": "...",
  "task_id": "{task_id}",
  "severity": "critical|important|minor",
  "applies_to": "...",
  "tags": ["..."]
}]'
```

---

### Step 5 — Report

Present review results:

```
## Review: {task_id} — {task_name}

### Files Reviewed
- file1.py — OK
- file2.py — 1 issue (OPEN decision D-NNN)

### Security
- No issues found / Issues: ...

### Decisions
- D-001: validated (reasoning sound)
- D-002: concern (LOW confidence, escalating)

### Gates
- test: PASS
- lint: PASS

### Verdict
APPROVED / NEEDS CHANGES (N open decisions)
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No changes for task | Nothing to review — skip |
| Security issue found | Record as OPEN decision with HIGH priority |
| Gate failure | Record finding, recommend fix |
| Decision without reasoning | Flag as incomplete |

## Resumability

- Review findings are persisted as decisions immediately
- Lessons are persisted immediately
- Can be re-run safely (dedup in decisions prevents duplicates)

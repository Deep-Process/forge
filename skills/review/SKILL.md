---
name: review
id: SKILL-REVIEW
version: "1.1"
description: "Deep code review for critical tasks — 3 perspectives."
---

# Review

Deep review for critical tasks. Use `/review {task_id}` when a task needs
more than the basic verification in `/next` Step 4.

## When to use

- Security-sensitive changes (auth, crypto, input handling)
- Architectural changes (new patterns, cross-cutting concerns)
- High-risk changes (data migration, payment logic)

## Procedure

### Step 1 — Understand Scope

```bash
python -m core.changes read {project} --task {task_id}
python -m core.decisions read {project} --task {task_id}
```

Read every changed file.

### Step 2 — Three-Perspective Review

#### Security

OWASP Top 10 focus: injection, secrets, auth/authz, input validation, dependency trust.

Verdict: `Security: {PASS|CONCERN|FAIL} — {1-line}`

#### Correctness

Does the code match the instruction? Edge cases (null, empty, overflow, concurrency)?
Error paths handled (not swallowed)? Existing functionality preserved?

Verdict: `Correctness: {PASS|CONCERN|FAIL} — {1-line}`

#### Testing

Tests included where required? Critical paths covered? Tests verify behavior, not implementation?
Run gates: `python -m core.gates check {project} --task {task_id}`

Verdict: `Testing: {PASS|CONCERN|FAIL} — {1-line}`

For each CONCERN or FAIL, record as an OPEN decision with appropriate type.

### Step 3 — Report

```
## Review: {task_id} — {task_name}

| Perspective | Verdict | Summary |
|-------------|---------|---------|
| Security    | ...     | ...     |
| Correctness | ...     | ...     |
| Testing     | ...     | ...     |

### Findings
- D-NNN: {issue} — {recommendation}

### Verdict
APPROVED / APPROVED WITH NOTES / NEEDS CHANGES
```

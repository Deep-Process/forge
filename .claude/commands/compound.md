# /compound

Extract lessons learned from project execution. This is the "Compound" phase —
turning experience into reusable knowledge for future projects.

Inspired by: "Each unit of engineering work should make subsequent units easier."

## Procedure

1. Find the active project and load full context:
```bash
python -m core.pipeline status {project}
python -m core.decisions read {project}
python -m core.changes read {project}
```

2. Review the project execution and identify lessons in these categories:
   - **pattern-discovered**: Reusable patterns found during implementation
   - **mistake-avoided**: Things that went wrong and how they were fixed
   - **decision-validated**: Decisions that proved correct
   - **decision-reversed**: Decisions that proved wrong
   - **tool-insight**: Better ways to use tools or libraries
   - **architecture-lesson**: Structural insights
   - **process-improvement**: Better workflow approaches

### Guidelines effectiveness

Analyze which guidelines were actually checked during execution:
```bash
python -m core.changes read {project}
python -m core.guidelines read {project} --status ACTIVE
```

Cross-reference `guidelines_checked` in change records against active guidelines:
- Which guidelines were checked most/least?
- Were any must-guidelines never checked? (potential gap)
- Include findings in lessons.

3. For each lesson, load the contract first:
```bash
python -m core.lessons contract
```

4. Record lessons:
```bash
python -m core.lessons add {project} --data '[
  {
    "category": "pattern-discovered",
    "title": "Concise, actionable title",
    "detail": "Explain WHY this matters, not just what happened",
    "task_id": "T-XXX",
    "decision_ids": ["D-XXX"],
    "severity": "critical|important|minor",
    "applies_to": "When is this lesson relevant?",
    "tags": ["searchable", "keywords"]
  }
]'
```

5. Show the recorded lessons:
```bash
python -m core.lessons read {project}
```

### AC Template Candidates

6. Analyze completed tasks for recurring acceptance criteria patterns:
```bash
python -m core.pipeline status {project}
python -m core.ac_templates read {project} --status PROPOSED
python -m core.ac_templates contract add
```

Review DONE tasks and their `acceptance_criteria`. Look for patterns that:
- Appear across 2+ tasks (same category of check)
- Are parameterizable (specific values can become `{placeholders}`)
- Would be useful in future projects

For each candidate pattern:

**a. Check existing PROPOSED templates** — if a very similar template already exists:
```bash
python -m core.ac_templates contract update
python -m core.ac_templates update {project} --data '[{"id": "AC-NNN", "occurrences": {N+1}, "source_tasks": ["T-XXX"]}]'
```
Increment `occurrences` and append the new task ID to `source_tasks`.

**b. If no similar PROPOSED exists** — create a new one per the `add` contract:
```bash
python -m core.ac_templates add {project} --data '[{...per contract..., "status": "PROPOSED", "source_tasks": ["T-XXX", "T-YYY"]}]'
```

Templates with high `occurrences` (3+) are strong candidates for promotion to ACTIVE.
Present candidates to the user:
```
## AC Template Candidates
| ID | Occ | Category | Template |
|----|-----|----------|----------|
| AC-005 | 4 | security | {pattern} |
| AC-007 | 2 | quality | {pattern} |

Recommend: AC-005 (4 occurrences) — promote to ACTIVE?
```

## Guidelines

- Focus on REUSABLE insights, not project-specific details
- Every lesson should be actionable — "always do X" or "never do Y"
- Link to specific decisions and tasks that generated the lesson
- Severity: critical = caused or would cause production issues, important = significant time/quality impact, minor = nice to know
- Ask the user if they have additional lessons to add
- Check past lessons to avoid duplicates: `python -m core.lessons read-all`

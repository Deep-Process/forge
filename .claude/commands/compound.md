# /compound

Extract lessons learned from project execution.

## Procedure

1. Load project context:
```bash
python -m core.pipeline status {project}
python -m core.decisions read {project}
python -m core.changes read {project}
```

2. Identify 3-7 lessons in these categories:
   - **pattern-discovered**: Reusable patterns found during implementation
   - **mistake-avoided**: Things that went wrong and how they were fixed
   - **decision-validated**: Decisions that proved correct
   - **decision-reversed**: Decisions that proved wrong
   - **architecture-lesson**: Structural insights
   - **process-improvement**: Better workflow approaches

3. Record lessons:
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

4. Show lessons and ask user if they have additions:
```bash
python -m core.lessons read {project}
```

## Rules

- Focus on REUSABLE insights, not project-specific details
- Every lesson should be actionable — "always do X" or "never do Y"
- Severity: critical = production issues, important = time/quality, minor = nice to know
- Check past lessons to avoid duplicates: `python -m core.lessons read-all`

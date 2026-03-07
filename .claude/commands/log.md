# /log

Show the full audit trail for a project: all changes and decisions, chronologically.

## Procedure

1. Find the active project.

2. Show pipeline status:
```bash
python -m core.pipeline status {project}
```

3. Show all decisions (full view):
```bash
python -m core.decisions read {project}
```

4. Show all changes:
```bash
python -m core.changes read {project}
```

5. Show change summary:
```bash
python -m core.changes summary {project}
```

6. Synthesize a narrative summary:
   - What was the goal?
   - What tasks were completed?
   - What key decisions were made and by whom?
   - What files were changed and why?
   - Are there any open decisions remaining?
   - What's the current state?

This provides a complete audit trail that anyone can read to understand
the full history of the project, from intent to implementation.

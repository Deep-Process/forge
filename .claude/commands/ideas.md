# /ideas $ARGUMENTS

Show and manage ideas in the staging area.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| (empty) | List all ideas | `/ideas` |
| `{idea_id}` | Show full details for an idea | `/ideas I-001` |
| `{idea_id} accept` | Mark idea as ACCEPTED | `/ideas I-001 accept` |
| `{idea_id} reject {reason}` | Reject idea with reason | `/ideas I-001 reject too risky for MVP` |
| `{idea_id} explore` | Start exploring (set EXPLORING) | `/ideas I-001 explore` |
| `{idea_id} commit` | Commit ACCEPTED idea for planning | `/ideas I-001 commit` |

## Procedure

Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

### List mode (no arguments):
```bash
python -m core.ideas read {project}
```

### Show mode (idea_id only):
```bash
python -m core.ideas show {project} {idea_id}
```

### Action modes:

**accept:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "ACCEPTED"}]'
```

**reject:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "REJECTED", "rejection_reason": "{reason}"}]'
```

**explore:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "EXPLORING"}]'
```
Then suggest: `/discover {idea_id}` to run analysis.

**commit:**
```bash
python -m core.ideas commit {project} {idea_id}
```
Then suggest: `/plan {idea_id}` to create task graph.

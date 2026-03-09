# /ideas $ARGUMENTS

Show and manage ideas in the staging area.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| (empty) | List all ideas | `/ideas` |
| `{idea_id}` | Show full details for an idea | `/ideas I-001` |
| `{idea_id} explore` | Start exploring (set EXPLORING) | `/ideas I-001 explore` |
| `{idea_id} ready` | Mark as READY (analysis complete) | `/ideas I-001 ready` |
| `{idea_id} approve` | Approve for implementation | `/ideas I-001 approve` |
| `{idea_id} reject {reason}` | Reject idea with reason | `/ideas I-001 reject too risky for MVP` |
| `{idea_id} park {reason}` | Temporarily shelve idea | `/ideas I-001 park waiting for infra upgrade` |
| `{idea_id} commit` | Commit APPROVED idea for planning | `/ideas I-001 commit` |
| `{idea_id} children` | Show child ideas | `/ideas I-001 children` |
| `root` | Show only root (top-level) ideas | `/ideas root` |

## Procedure

Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

### List mode (no arguments):
```bash
python -m core.ideas read {project}
```

### Root ideas only:
```bash
python -m core.ideas read {project} --parent root
```

### Show mode (idea_id only):
```bash
python -m core.ideas show {project} {idea_id}
```

### Children mode:
```bash
python -m core.ideas read {project} --parent {idea_id}
```

### Action modes:

**explore:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "EXPLORING"}]'
```
Then suggest: `/discover {idea_id}` to run analysis.

**ready:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "READY"}]'
```

**approve:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "APPROVED"}]'
```

**reject:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "REJECTED", "rejection_reason": "{reason}"}]'
```

**park:**
```bash
python -m core.ideas update {project} --data '[{"id": "{idea_id}", "status": "PARKED", "rejection_reason": "{reason}"}]'
```

**commit:**
```bash
python -m core.ideas commit {project} {idea_id}
```
Then suggest: `/plan {idea_id}` to create task graph.

# /guidelines $ARGUMENTS

Show and manage project guidelines.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| (empty) | List all active guidelines | `/guidelines` |
| `{scope}` | List guidelines for a scope | `/guidelines backend` |
| `{guideline_id} deprecate` | Deprecate a guideline | `/guidelines G-001 deprecate` |
| `{guideline_id} must` | Promote to must weight | `/guidelines G-003 must` |

## Procedure

Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

### List mode (no arguments):
```bash
python -m core.guidelines read {project} --status ACTIVE
```

### Scope filter mode:
```bash
python -m core.guidelines read {project} --scope {scope}
```

### Deprecate mode:
```bash
python -m core.guidelines update {project} --data '[{"id": "{guideline_id}", "status": "DEPRECATED"}]'
```

### Weight change mode:
```bash
python -m core.guidelines update {project} --data '[{"id": "{guideline_id}", "weight": "{must|should|may}"}]'
```

# /research $ARGUMENTS

Manage research objects (R-NNN) — structured analysis summaries linked to objectives, ideas, and decisions.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| (none) | List all research | `/research` |
| `{id}` | Show research details | `/research R-001` |
| `{entity}` | Research for entity | `/research O-001` |

## Instructions

Use `core.research` CLI commands:

```bash
# List all research
python -m core.research read {project}

# Show specific research
python -m core.research show {project} {research_id}

# Research linked to an entity
python -m core.research context {project} --entity {entity_id}

# Add new research (load contract first)
python -m core.research contract add
python -m core.research add {project} --data '[...]'

# Update research
python -m core.research contract update
python -m core.research update {project} --data '[...]'
```

Research is typically created by `/discover` during exploration. Use this command to view or manage existing research objects.

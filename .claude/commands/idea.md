# /idea $ARGUMENTS

Add an idea to the staging area for exploration before planning.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{title}` | Quick add with title | `/idea Add Redis caching to API` |
| `{title} --priority HIGH` | Add with priority | `/idea Fix auth module --priority HIGH` |
| `{title} --parent I-001` | Add as sub-idea | `/idea Signal Generator --parent I-001` |

## Procedure

1. Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

If no project exists, create one:
```bash
python -m core.pipeline init {slug} --goal "Project workspace"
```

2. Check the contract:
```bash
python -m core.ideas contract add
```

3. Create the idea from the user's input. Ask for description if only title given.

```bash
python -m core.ideas add {project} --data '[{
  "title": "{from arguments}",
  "description": "{what and why}",
  "category": "{feature|improvement|experiment|migration|refactor|infrastructure}",
  "priority": "{HIGH|MEDIUM|LOW}",
  "tags": ["{relevant tags}"],
  "parent_id": "{parent idea ID or omit for root}",
  "relations": [{"type": "depends_on|related_to|supersedes|duplicates", "target_id": "I-NNN"}]
}]'
```

4. Present the created idea and suggest next steps:
   - `/discover {idea_id}` — explore feasibility, risks, architecture
   - `/ideas` — see all ideas
   - `/ideas {idea_id} children` — if this is a parent, see sub-ideas
   - If user is confident: `/ideas {idea_id} approve` then `/plan {idea_id}`

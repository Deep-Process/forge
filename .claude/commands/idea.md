# /idea $ARGUMENTS

Add an idea to the staging area — lightweight capture, not alignment.

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

2. **Capture** (not align — alignment happens at /objective or /plan):

   a. If anything is genuinely unclear, ask 1-2 questions. If the title is self-explanatory, skip.

   b. **Check if objectives exist** — if so, ask which KR(s) this idea advances:
      ```bash
      python -m core.objectives read {project}
      ```
      If yes, set `advances_key_results` and inherit the objective's scopes.

3. Create the idea:

```bash
python -m core.ideas add {project} --data '[{
  "title": "{from arguments}",
  "description": "{what and why}",
  "category": "{feature|improvement|experiment|migration|refactor|infrastructure}",
  "priority": "{HIGH|MEDIUM|LOW}",
  "tags": ["{relevant tags}"],
  "parent_id": "{parent idea ID or omit}",
  "relations": [{"type": "depends_on|related_to|supersedes|duplicates", "target_id": "I-NNN"}],
  "advances_key_results": ["{O-NNN/KR-N if linked}"],
  "scopes": ["{inherited from objective}"]
}]'
```

4. Suggest next steps:
   - `/discover {idea_id}` — explore feasibility, risks, architecture
   - `/ideas {idea_id} approve` then `/plan {idea_id}` — if confident

## Design note

Ideas are capture, not alignment. Don't re-align what was already aligned at /objective.
If entering Forge via /idea (no objective), alignment will happen at /plan.

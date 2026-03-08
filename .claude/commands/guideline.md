# /guideline $ARGUMENTS

Add a project guideline (coding standard, convention, architectural rule).

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{description}` | Add a guideline interactively | `/guideline all API endpoints must have rate limiting` |
| `{description} --scope {scope}` | Add with explicit scope | `/guideline use Repository Pattern --scope backend` |
| `{description} --weight must` | Add as must-follow | `/guideline no SELECT * in queries --scope database --weight must` |

## Procedure

1. Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

If no project exists, ask user to create one first with `/plan`.

2. Check the contract:
```bash
python -m core.guidelines contract add
```

3. Parse the user's input to extract:
   - **title**: concise name
   - **scope**: infer from content (e.g., SQL → database, API → api, general if unclear). Ask if ambiguous.
   - **content**: the full guideline text (expand from the user's shorthand if needed)
   - **weight**: default `should`, use `must` if user says "always", "never", "must"
   - **rationale**: ask or infer why this matters

```bash
python -m core.guidelines add {project} --data '[{
  "title": "{concise title}",
  "scope": "{scope}",
  "content": "{full guideline}",
  "rationale": "{why}",
  "weight": "{must|should|may}"
}]'
```

4. Confirm what was added and show current scope summary:
```bash
python -m core.guidelines scopes {project}
```

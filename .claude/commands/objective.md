# /objective $ARGUMENTS

Define a business objective with measurable key results — the "north star" for work.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{title}` | Define objective interactively | `/objective Reduce API response time` |
| `{title} --quick` | Skip alignment, add directly | `/objective Fix auth perf --quick` |

## Procedure

1. Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

If no project exists, create one:
```bash
python -m core.pipeline init {slug} --goal "Project workspace"
```

2. **MANDATORY: Read `skills/deep-align/SKILL.md` and apply its full procedure** (Steps 1-3: restate, find the walls, alignment contract). This is NOT optional — objectives set direction for everything downstream. A bad objective produces bad ideas, bad plans, bad tasks.

   a. **Restate** the user's objective: "You want to achieve X because Y."
      Get confirmation before proceeding.

   b. **Have opinions. Push back.** Before asking questions, state your honest assessment of the objective:
      - Is it too vague? Say so: "This is too broad — it could mean 5 different things. I'd narrow it to X."
      - Is it unrealistic? Say so: "This is a 3-month project disguised as a week of work."
      - Is it a bad idea? Say so: "I'd advise against this because X. Consider Y instead."
      - Is it well-defined? Say so: "This is clear and well-scoped, I'd keep it as-is."
      Don't be polite at the expense of clarity. The user explicitly wants honest pushback.

   c. **Ask 2-4 targeted questions** (group in one message):
      - "How will you know this is achieved? What metric(s) change?"
      - "Where are you now on that metric? Where do you want to be?"
      - "What is explicitly NOT in scope?"
      - "What assumptions must hold for this to make sense?"

      If scopes are known, load domain-specific vision questions to refine KR definition:
      ```bash
      python -m core.domain_modules for-scopes --scopes "{scopes}" --phase vision
      ```
      Use domain questions alongside generic alignment (e.g., backend scope → "what's current p95 latency?" helps define KR target). Cap at 4-6 questions total.

      Only ask what you genuinely don't know.

   d. **Constraint-frame the description** — before saving, add 1-3 short constraints to the description:
      - What sources/inputs to use (ONLY X)
      - What NOT to do (don't assume, don't expand scope)
      - What to do when blocked (report gap, don't guess)

      Present the framed description to the user for confirmation.

   e. If `--quick` — skip alignment, infer reasonable defaults, flag assumptions.

3. Create the objective from confirmed understanding:

```bash
python -m core.objectives add {project} --data '[{
  "title": "{confirmed title}",
  "description": "{why this matters, business context}",
  "key_results": [
    {"metric": "{what we measure}", "baseline": N, "target": N},
    {"metric": "{second metric}", "baseline": N, "target": N}
  ],
  "appetite": "{small|medium|large}",
  "scope": "{project|cross-project}",
  "assumptions": ["{assumption 1}", "{assumption 2}"],
  "tags": ["{relevant tags}"],
  "scopes": ["{guideline scopes this objective relates to}"]
}]'
```

5. **Optionally create derived guidelines** — if the objective implies coding standards:
   - e.g., KR "p95 < 200ms" → guideline "Every endpoint must have latency benchmark"
   - Create the guideline with `derived_from: "O-001"` for traceability:
   ```bash
   python -m core.guidelines add {project} --data '[{
     "title": "{standard implied by objective}",
     "scope": "{from objective scopes}",
     "content": "{what to do}",
     "rationale": "Derived from objective O-001: {objective title}",
     "weight": "must",
     "derived_from": "O-001"
   }]'
   ```
   Then link back: update the objective's `derived_guidelines` with the new guideline ID.
   Only create guidelines when a KR clearly implies an enforceable standard. Do NOT auto-generate.

6. Present the created objective and suggest next steps:
   - `/idea {title}` — propose Ideas that advance specific Key Results
   - `/research O-001` —  structured analysis summaries linked to objectives
   - `/objectives` — see all objectives
   - `/objectives O-001` — see details + coverage
   - `/guideline {text}` — create standards derived from this objective
   - Remind: when creating Ideas, link them with `advances_key_results: ["O-001/KR-1"]`

## Key Results Guidelines

Good KRs are:
- **Measurable**: has a number (not "improve performance" but "p95 < 200ms")
- **Bounded**: has baseline AND target (not just target)
- **Outcome-focused**: measures result, not output ("retention up 20%" not "ship 5 features")
- **2-5 per objective**: fewer = too vague, more = unfocused

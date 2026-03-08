# /discover $ARGUMENTS

Discovery phase — explore options, assess risks, and prepare architecture BEFORE planning.

Uses deep-orchestration to coordinate deep-* analysis skills (deep-explore, deep-risk, deep-architect, deep-feasibility) and records findings as Forge decisions.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{topic}` | Explore a topic / direction | `/discover authentication for the API` |
| `{topic} --full` | Run all 4 analysis skills | `/discover migration to microservices --full` |
| `{topic} --risk-only` | Run only deep-risk | `/discover switching to Redis --risk-only` |

## Instructions

Read and follow the procedure in `skills/discover/SKILL.md`.

Key points:
- deep-orchestration is the CONDUCTOR — it decides sequencing and parallelism
- You are the BRIDGE between Forge context and deep-* analysis
- Record ALL significant findings as OPEN decisions in Forge
- If feasibility = NO-GO, STOP and present to user. Do NOT auto-proceed to /plan.
- Present a Discovery Brief at the end with clear next steps

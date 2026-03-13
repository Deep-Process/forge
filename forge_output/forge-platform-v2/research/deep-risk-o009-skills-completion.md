# Deep Risk Analysis: O-009 Skills Management Completion
Date: 2026-03-12T12:00:00Z
Skill: deep-risk v1.0.0
Decision: D-029 (linked after recording)

---

Scope: Completing O-009 Skills Management to 100% KR achievement
Horizon: 1-2 weeks

## Risk Register

| # | Risk | P | I | V | D | R | Composite | Category |
|---|------|---|---|---|---|---|-----------|----------|
| R1 | TESLint not installed in Docker | 3 | 4 | 5 | 4 | 2 | 23 | Dependency |
| R2 | Task-skill integration incomplete | 3 | 3 | 2 | 2 | 1 | 14 | Technical |
| R3 | Usage count not incrementing | 2 | 2 | 1 | 3 | 1 | 9 | Technical |
| R4 | Scope-based skill filtering missing | 2 | 3 | 2 | 2 | 1 | 11 | Technical |
| R5 | Skills page not in main navigation | 1 | 3 | 1 | 1 | 1 | 6 | UX |
| R6 | WS events not triggering SWR revalidation | 2 | 2 | 2 | 3 | 1 | 10 | Technical |
| R7 | Force-promoted skills missing visual badge | 2 | 2 | 1 | 2 | 1 | 8 | UX |

## Top 5 Risks (by composite score)

### 1. TESLint not installed in Docker — Composite: 23
Description: If TESLint Python package is not in requirements.txt or Docker image, all lint/promote endpoints fail at runtime
Why it ranks high: High velocity (instant failure on first use) and low detectability (no one has tested this in the container yet)
Mitigation: Verify TESLint in requirements.txt, add health check, test lint endpoint in Docker

### 2. Task-skill integration incomplete — Composite: 14
Description: TaskForm dropdown for skill selection may be a stub or missing key features (search, scope filtering, validation)
Why it ranks high: This is the key integration point — skills are only useful if tasks can reference them
Mitigation: Code review TaskForm.tsx, verify dropdown works end-to-end with real skills data

### 3. Scope-based skill filtering missing — Composite: 11
Description: GET /skills endpoint may not support scope-based filtering, making the dropdown show ALL skills regardless of task context
Why it ranks high: Without filtering, skill discovery degrades as the library grows
Mitigation: Verify scopes query param works on GET /skills, implement frontend scope-based filtering

### 4. WS events not triggering SWR revalidation — Composite: 10
Description: Skills page may not auto-refresh when a skill is created/updated/promoted via another tab or API
Why it ranks high: Low detectability — looks fine until multi-user testing
Mitigation: Verify skillStore.ts properly triggers SWR revalidation on WS events

### 5. Usage count not incrementing — Composite: 9
Description: The usage_count field exists but may never be incremented — tasks.py may not call skills update on task creation
Why it ranks high: Makes "usage tracking" KR hollow
Mitigation: Check tasks router for usage_count increment logic

## Risk Interactions

| Risk A | Risk B | Interaction | Cascade? |
|--------|--------|-------------|----------|
| R1 (TESLint) | R7 (badge) | If TESLint fails, force-promote becomes the only path, making badge more important | Yes |
| R2 (task integration) | R3 (usage count) | If task integration is incomplete, usage count will always be 0 | Yes |
| R4 (scope filter) | R2 (task integration) | If filtering is missing, dropdown shows ALL skills — poor UX | Amplifies |

## Mitigations + Cobra Effect Check

| Mitigation | Fixes | Could Cause/Amplify | Cobra? |
|------------|-------|---------------------|--------|
| Add TESLint to requirements.txt | R1 | Adds Python dependency, increases image size ~5MB | No |
| Code review TaskForm skill dropdown | R2 | None | No |
| Add scope filter to GET /skills | R4 | May return empty results if scopes don't match — need "all skills" fallback | Minor |
| Health check endpoint for TESLint | R1 | Extra endpoint to maintain | No |
| Verify WS events + SWR revalidation | R6 | None | No |

## Uncertainties (distinct from risks)
- Will TESLint rules be relevant for all skill types? (deep-* skills have different structure than task execution skills)
- Will users actually create custom skills, or only use built-in ones?
- How many skills will a typical project have? (10? 50? 500?)

## Not Assessed
- Security risks (no auth on skills endpoints — covered by platform-level auth)
- Performance risks (skills table is small, unlikely to need optimization)
- Data migration risks (no existing skills data to migrate)
- Multi-user conflicts (simultaneous skill editing — deferred to v2)

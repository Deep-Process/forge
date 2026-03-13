# Deep Risk Analysis: O-009 Skills Management
Date: 2026-03-11T22:30:00Z
Skill: deep-risk v1.0.0
Decision: D-016 (linked after recording)

---

## Risk Assessment: Skills Management Module
Scope: Backend API + Frontend UI + TESLint integration | Horizon: 2-4 weeks

## Risk Register

| # | Risk | P | I | V | D | R | Composite | Category |
|---|------|---|---|---|---|---|-----------|----------|
| R1 | TESLint temp dir in Docker — write access or cleanup failure | 2 | 3 | 3 | 2 | 2 | 13 | Technical |
| R2 | Global routing conflict with per-project middleware | 2 | 4 | 4 | 3 | 2 | 17 | Technical |
| R3 | SKILL.md bundled resources (scripts/) storage for binary files | 3 | 2 | 2 | 3 | 2 | 13 | Technical |
| R4 | Navigation UX — where Skills fits in global vs project context | 2 | 3 | 2 | 2 | 1 | 11 | Knowledge |
| R5 | TESLint scanner path structure (.claude/skills/*/SKILL.md) | 3 | 3 | 4 | 4 | 1 | 18 | Dependency |
| R6 | Skill versioning — editing ACTIVE skill affects referencing tasks | 3 | 3 | 2 | 3 | 3 | 17 | Knowledge |
| R7 | Scope creep — UI editor perfectionism | 4 | 2 | 2 | 2 | 1 | 13 | Organizational |

## Top 5 Risks (by composite score)

### 1. R5 — TESLint Path Structure — Composite: 18
**Description:** TESLint scanner discovers files matching `.claude/skills/*/SKILL.md`. If temp dir has wrong structure, linter finds nothing and returns 0 findings (false pass).
**Why it ranks high:** Detectability=4 (false pass is silent), Velocity=4 (blocks linting immediately).
**Mitigation:** Create temp dir with exact structure: `/tmp/teslint-{uuid}/.claude/skills/{skill_name}/SKILL.md`. Write SKILL.md content to that path. Verify with a test lint during development.

### 2. R2 — Global Routing Conflict — Composite: 17
**Description:** FastAPI middleware assumes `{slug}` in path. Skills router at `/api/v1/skills` has no slug. Dependency injection, auth middleware, event emission may fail.
**Why it ranks high:** Impact=4 (breaks entire Skills API), Velocity=4 (fails on first request).
**Mitigation:** Verify auth middleware works on JWT header (not path). Create skills router independently, don't reuse `get_project_dependency`. Extract shared helpers (auth, events) from project-scoped helpers.

### 3. R6 — Skill Versioning Gap — Composite: 17
**Description:** User edits ACTIVE skill. Tasks referencing skill_id see updated content immediately. No rollback, no diff, no audit trail of SKILL.md changes.
**Why it ranks high:** Reversibility=3 (cannot undo SKILL.md edit), Detectability=3 (user may not realize impact).
**Mitigation:** v1: update-in-place with `updated_at` timestamp. Document behavior. v2: add version history (optional). promotion_history already tracks promotion events.

### 4. R1 — TESLint Temp Dir Docker — Composite: 13
**Description:** Docker container may have read-only filesystem or limited /tmp space. Cleanup may fail, leaving orphaned dirs.
**Why it ranks high:** Moderate across all dimensions.
**Mitigation:** Use Python `tempfile.mkdtemp()` with `finally: shutil.rmtree()`. Verify /tmp is writable in Dockerfile. Add periodic cleanup cron for orphaned dirs.

### 5. R7 — Scope Creep — Composite: 13
**Description:** SKILL.md editor wants syntax highlighting, live preview, diff view, auto-complete. Each "small addition" adds 200+ LOC.
**Why it ranks high:** Probability=4 (near-certain for any editor UI).
**Mitigation:** v1: plain textarea with monospace font. "Lint" button for validation. No syntax highlighting, no live preview. Defer to v2 based on user feedback.

## Risk Interactions

| Risk A | Risk B | Interaction | Cascade? |
|--------|--------|-------------|----------|
| R5 (TESLint path) | R1 (temp dir Docker) | R5 requires correct structure in temp dir, R1 concerns ability to create temp dirs | Yes — R1→R5 |
| R7 (scope creep) | R6 (versioning) | Versioning is feature creep — adding it now increases scope | Yes — R6→R7 |
| R2 (global routing) | R4 (nav UX) | Both stem from Skills being global (non-project) entity | Shared root cause |

## Mitigations + Cobra Effect Check

| Mitigation | Fixes | Could Cause/Amplify | Cobra? |
|------------|-------|---------------------|--------|
| Temp dir with `.claude/skills/` structure | R5 | More code in backend, cleanup edge cases | Minor |
| Update-in-place for v1, defer versioning | R6, R7 | Users lose change history in SKILL.md | Accept for v1 |
| Separate router skills.py without slug dependency | R2 | Helper duplication (auth, events) | Minor — extract shared |
| Plain textarea editor for v1 | R7 | Users may find editor too basic | Accept — iterate based on feedback |
| Python tempfile.mkdtemp() with finally cleanup | R1 | None identified | No cobra |

## Uncertainties (distinct from risks)

1. **How many skills will users actually create?** (affects search/filter importance)
2. **Will users prefer CLI-based skill-creator workflow or in-platform editor?** (affects editor investment)
3. **How often will TESLint rules change?** (affects pinning strategy)

## Not Assessed

- Multi-tenant access control for skills
- Skill marketplace / sharing between organizations
- Performance under concurrent lint requests (>10 simultaneous)
- Accessibility (WCAG) of SKILL.md editor
- Mobile responsiveness of Skills pages

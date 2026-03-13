# Deep Explore Analysis: O-009 Skills Management Completion
Date: 2026-03-12T12:00:00Z
Skill: deep-explore v1.0.0
Decision: D-028 (linked after recording)

---

## Knowledge Audit

### Known Facts (confirmed by codebase)
- Backend: 6+ CRUD endpoints + lint + promote + categories + import/export at /api/v1/skills (829-line router)
- PostgreSQL: skills table exists with all fields, GIN indexes, FTS (migration 005_skills.sql, 60 lines)
- Frontend: list page (308 lines), SkillEditor (670 lines), create page, Zustand store, API client, WS events
- TESLint: subprocess integration (176 lines) creates temp dir, runs python -m teslint, parses JSON
- Promotion: 3-gate validation + force override + promotion history tracking
- Skills are GLOBAL (no project_id FK) with endpoints at /api/v1/skills (per D-023, D-024)
- 10 default categories with colors + custom category creation
- Task table has `skill` field in schema
- Architecture decisions D-023 through D-027 all ACCEPTED/MITIGATED

### Assumptions (treated as true, not fully verified)
- TESLint Python package installed in Docker container
- Frontend TaskForm has skill_id dropdown (commit message mentions it)
- Usage count is incremented server-side on task creation
- All WS events properly dispatched and consumed

### Unknown Gaps
- Does TaskForm actually filter skills by scope matching with task scopes?
- Is usage_count actually incremented, or just a schema field?
- How complete is "Used by tasks" reverse lookup?
- Does SKILL.md editor have markdown preview?
- What's the state of evals editing UI? (structured form vs raw JSON)

---

## Options

| Option | Description | Effort | Risk | Benefit | Key Unknown |
|--------|-------------|--------|------|---------|-------------|
| A: Targeted fixes | Fix only verified gaps (task integration UI, usage tracking, scope grouping) | Small (3-5 tasks) | Low | Closes KRs to 100% | Are gaps actually gaps or already done? |
| B: Full polish pass | Fix gaps + enhancements (inline TESLint annotations, markdown preview, .teslintrc editor) | Medium (8-12 tasks) | Medium | Production-quality module | Is it premature? |
| C: Defer to testing | Accept ~75%, update KRs, defer gaps to O-006 | Minimal (1-2 tasks) | Low | Focus on other objectives | Will testing be harder with gaps? |

---

## Consequence Trace

### Option A: Targeted fixes
- 1st order: KRs reach 100%, O-009 can be marked ACHIEVED
- 2nd order: Task-skill integration enables skill-driven execution in /next and /run
- 3rd order: Skills become usable in real workflow, driving adoption and feedback

### Option B: Full polish
- 1st order: Production-quality module, but 8-12 more tasks
- 2nd order: Delays O-005 (UI/UX), O-006 (Testing), O-007 (Debug Console)
- 3rd order: Risk of over-engineering before real-world usage validates design

### Option C: Defer
- 1st order: Frees capacity for testing (O-006) which is at 0%
- 2nd order: Testing may reveal some "gaps" aren't actually needed
- 3rd order: But if gaps are real, fixing them during testing is more disruptive

---

## Challenge Round

### Option A — Strongest counter-argument
"Targeted fixes" may miss edge cases a broader review would catch. The task form skill dropdown may look complete but have subtle UX issues that make it unusable in practice.

### Option B — Strongest counter-argument
Premature optimization. Zero real users. Building .teslintrc editors before anyone uses basic CRUD is waste.

### Option C — Strongest counter-argument
Leaving known gaps unfixed creates technical debt. Testing at O-006 will be harder with incomplete Skills module.

---

## Recommended Path

**Option A: Targeted fixes (3-5 tasks)**

The module is ~75% done. A small push completes the KRs. This is the highest ROI path.

Steps:
1. Verify and fix task-skill integration (TaskForm dropdown, usage_count increment)
2. Add scope-based skill filtering in frontend dropdown
3. Add "Used by tasks" section in skill detail page
4. Verify TESLint works in Docker container
5. Update O-009 KR values to reflect actual state

Defer Option B enhancements to post-testing iteration based on real usage feedback.

## What Was NOT Explored
- Multi-file skill support (scripts/, references/, assets/) — v2 feature
- Skill versioning with rollback — v2 feature
- Skill ownership and multi-user permissions — v2 feature
- Integration with deep-* analysis skills (which are built-in, not DB-managed)
- Interaction with skill-creator framework evals grading

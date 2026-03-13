# Deep Architect Analysis: O-009 Skills Management — Remaining Design
Date: 2026-03-12T12:00:00Z
Skill: deep-architect v1.0.0
Decision: D-030 (linked after recording)

---

## Overview

Architecture decisions for completing the remaining ~25% of O-009 Skills Management. The core architecture (global DB storage, API routing, TESLint subprocess) is already decided and implemented (D-023 through D-027). These ADRs cover the integration and UX gaps.

## Architecture Decision Records

### ADR-1: Task-Skill Integration Pattern
- **Status**: Proposed
- **Context**: Tasks need to reference global skills. Backend has `skill` field (TEXT). Frontend needs dropdown in TaskForm showing ACTIVE skills filtered by scope.
- **Decision**: Use `skill_id` (S-NNN string) in task, with backend validation that skill exists and is ACTIVE or DEPRECATED (with warning). Frontend: async select with search and scope-based filtering.
- **Alternatives considered**: (a) Store full SKILL.md content in task — rejected, duplication. (b) Use skill name instead of ID — rejected, not unique.
- **Consequences**: Gain: clean reference, usage tracking, dependency validation. Lose: extra API call on task creation.

### ADR-2: Usage Tracking Implementation
- **Status**: Proposed
- **Context**: O-009/KR-6 requires tracking which tasks use which skills. usage_count field exists in skills table.
- **Decision**: Increment usage_count in tasks router on task creation when skill_id is set. Add reverse lookup: GET /skills/{id} includes `used_by_tasks` array in response. Decrement on task deletion.
- **Alternatives considered**: (a) Only track count, not which tasks — less useful for dependency check. (b) Track at execution time, not creation — task may never execute.
- **Consequences**: Gain: "Used by" visibility, prevents deletion of in-use skills. Lose: count may drift if tasks are bulk-deleted without updating skills.

### ADR-3: Scope-Based Skill Suggestion
- **Status**: Proposed
- **Context**: When creating a task with scopes ["backend", "api"], skill dropdown should prioritize matching skills.
- **Decision**: Frontend sends task scopes as query param ?scopes=backend,api. Backend filters by GIN array overlap (scopes && ARRAY[...]). Show matching skills first in "Recommended" section, then "All skills" section.
- **Alternatives considered**: (a) No filtering — doesn't scale. (b) Strict filter, hide non-matching — too restrictive.
- **Consequences**: Gain: relevant skills surfaced first. Lose: slightly more complex dropdown.

### ADR-4: KR Measurement Approach
- **Status**: Proposed
- **Context**: O-009 has 7 KRs, most with boolean targets. Need to determine current actual values vs target.
- **Decision**: Audit each KR against actual codebase, update current values honestly, then plan tasks only for gaps. Don't create tasks for already-met KRs.
- **Alternatives considered**: (a) Plan full task set for all 7 KRs — waste for implemented ones. (b) Just mark all KRs as done — dishonest.
- **Consequences**: Gain: accurate progress tracking, efficient task planning. Lose: requires careful code review before planning.

## Components

| Component | Responsibility | Technology | Status |
|-----------|---------------|------------|--------|
| skills.py (router) | CRUD + lint + promote + categories | FastAPI | Done |
| teslint.py (service) | TESLint subprocess | Python subprocess | Done |
| frontmatter.py (service) | YAML parser | PyYAML | Done |
| 005_skills.sql | DB schema | PostgreSQL | Done |
| SkillEditor.tsx | Create/edit UI | React + Next.js | Done |
| skills/page.tsx | List UI | React + Next.js | Done |
| skillStore.ts | State + WS | Zustand | Done |
| TaskForm skill dropdown | Task-skill link UI | React | Partial |
| Skill usage section | "Used by" display | React | Missing |
| Scope filter in dropdown | Smart suggestion | React + API | Missing |

## Adversarial Findings

| # | Challenge | Finding | Severity | Mitigation |
|---|-----------|---------|----------|------------|
| 1 | FMEA | TESLint subprocess fails silently if package not installed | Medium | Health check endpoint |
| 2 | Dependency | TaskForm depends on skills API being available | Low | Graceful fallback if /skills returns error |
| 3 | Anti-pattern | usage_count as denormalized counter — can drift | Low | Periodic reconciliation job (defer to v2) |
| 4 | Pre-mortem | Skills module unused because no one knows it exists | Medium | Ensure nav link is prominent, add to onboarding |
| 5 | STRIDE | No authorization on skill CRUD — any user can delete | Low | Platform-level auth covers this |

## Tradeoffs

| Chose | Over | Because | Lost | Gained |
|-------|------|---------|------|--------|
| Global skills (no project_id) | Per-project skills | Skills are reusable across projects | Project isolation | Reusability, single library |
| S-NNN string ID in task.skill | Integer FK | Consistent with Forge entity ID pattern | Type safety | Flexibility, human-readable |
| Scope-based suggestion | Strict scope filtering | Users may want skills outside their scopes | Perfect relevance | Discoverability |
| Denormalized usage_count | JOIN query each time | Performance for list views | Data consistency | Speed |

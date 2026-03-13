# Deep Explore Analysis: O-009 Skills Management
Date: 2026-03-11T22:30:00Z
Skill: deep-explore v1.0.0
Decision: D-014 (linked after recording)

---

## Knowledge Audit

### Known Facts
- Platform has 14 entities with full CRUD (router + store + page + card + form)
- Factory pattern for stores (createEntitySlice) makes new entity ~500 LOC
- Skills exist in Forge CLI as SKILL.md files in `skills/` directory
- Tasks reference skills via optional `skill: "path/to/SKILL.md"` field
- Anthropic skill-creator defines format: SKILL.md with YAML frontmatter + bundled resources
- TESLint validates SKILL.md — 35 rules, 7 categories, deterministic, Python + PyYAML
- TESLint needs directory input with `.claude/skills/*/SKILL.md` structure
- TESLint outputs JSON with `--format json`, exit code 0=pass, 1=errors
- Backend: FastAPI + PostgreSQL + Redis events + WebSocket
- Frontend: Next.js 14 + Zustand factory + SWR + react-hook-form + zod
- Auth: JWT on all endpoints

### Assumptions (Validated)
- TESLint CAN run on temp dir with correct `.claude/skills/{name}/SKILL.md` structure ✓
- skill-creator is an interactive workflow tool, NOT a runtime API ✓
- SKILL.md content fits comfortably in PostgreSQL TEXT column (max ~500 lines = 40KB) ✓
- evals JSON is small (~50KB max) — fine for JSONB column ✓

### Unknown Gaps (Addressed in Analysis)
- Bundled resources storage → JSONB metadata + deferred file upload for v2
- Skill versioning → Update-in-place for v1, defer versioning to v2
- Global routing compatibility → Verified: JWT auth works without slug, separate router needed

## Options

### Option A: Full DB Storage
- SKILL.md content → TEXT column
- Evals → JSONB column
- Bundled resources → JSONB metadata (file content deferred to v2)
- TESLint: extract to temp dir on demand

**Pros:** Simple deployment, single storage, queryable, backup via pg_dump
**Cons:** TESLint needs temp dir extraction (100-500ms overhead)
**Verdict:** Part of recommended approach (combined with Option C)

### Option B: Hybrid (DB + Filesystem)
- Metadata in DB, SKILL.md + resources on disk
- TESLint runs directly on files

**Pros:** Natural file structure for TESLint
**Cons:** Complex deployment (volume mounts), dual backup, sync issues
**Verdict:** REJECTED — complexity not justified

### Option C: DB + Temp Dir for Linting (RECOMMENDED)
- Everything in DB like Option A
- TESLint: extract to temp dir only when linting or promoting
- Temp dir with correct structure: `/tmp/teslint-{id}/.claude/skills/{name}/SKILL.md`

**Pros:** Simple storage + native TESLint, lazy extraction (only on lint/promote)
**Cons:** Subprocess overhead (acceptable — user-initiated only)
**Verdict:** RECOMMENDED — best of both worlds

## Consequence Trace

### Option C (Recommended)
- **1st order:** SKILL.md in DB — CRUD identical to other entities, searchable, backupable
- **2nd order:** TESLint extract is lazy — only on "Lint" or "Promote" button — not on every CRUD operation
- **3rd order:** Temp dir cleanup is automatic (Python tempfile module) — zero maintenance cost

## Challenge Round

### Option C — Strongest Counter-Argument
"Storing SKILL.md in DB is an anti-pattern — skill-creator assumes filesystem"

**Rebuttal:** skill-creator is a CLI/interactive tool, not an API. Platform mode already transforms data formats (JSON files → PostgreSQL). GitHub stores files in DB (git objects), not filesystem. The DB is the source of truth; filesystem is a transient view for tools that need it.

### Failure Condition
TESLint requires persistent state between invocations (e.g., cache). **Verified:** TESLint is stateless — each invocation is independent. No failure risk.

## Recommended Path
Option C: Full DB storage with on-demand temp dir extraction for TESLint. This aligns with existing entity patterns, keeps deployment simple, and gives TESLint what it needs without permanent filesystem management.

## What Was NOT Explored
- Multi-tenant skill sharing (skills visible to specific users/teams)
- Skill marketplace / import from external repos
- Automatic skill suggestions based on task content
- skill-creator integration as an in-platform workflow (vs just format compliance)
- Performance of TESLint subprocess at scale (100+ concurrent lint requests)

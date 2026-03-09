# Assumptions & Deferred Decisions

This file tracks every assumption made during development and every decision deferred for later.
Updated as assumptions are validated or invalidated.

---

## Active Assumptions

### A-001: Single project at a time (for now)
- **Assumed**: Forge manages one project/goal at a time per working directory
- **Why**: Simplifies pipeline state. Multi-project needs orchestration layer.
- **Risk**: Low — can extend later without breaking core
- **Deferred to**: v2 (multi-agent support)

### A-002: ~~Git is always available~~ RESOLVED
- **Decision**: Git is recommended but optional. Forge works without git (with warnings).
- **Why resolved**: `changes diff` requires git, but `changes record` works without it. No dedicated git wrapper needed — standard git CLI is used directly.
- **Resolved in**: v1.0

### A-003: Python 3.8+ available
- **Assumed**: Target runtime is Python 3.8 or later
- **Why**: Using type hints, pathlib, f-strings. No match/case used anywhere.
- **Risk**: Low — Claude Code environments typically have modern Python

### A-004: Claude Code is the primary (but not only) consumer
- **Assumed**: SKILL.md files are read by Claude Code, but core/ tools work standalone
- **Why**: Core tools are plain CLI — any LLM or human can use them
- **Risk**: None — this is a feature, not a limitation

### A-005: Task graph is a DAG (no cycles)
- **Assumed**: Tasks can depend on other tasks, but no circular dependencies
- **Why**: Simplifies pipeline execution. Cycles would require iteration semantics.
- **Risk**: Low — real development workflows are naturally DAGs
- **Mitigation**: Validation at task creation time

### A-006: Skills are file-based, not package-based
- **Assumed**: A skill is a directory with SKILL.md + optional Python tools
- **Why**: Matches Skill_v1 pattern. Easy to read, copy, customize.
- **Risk**: Doesn't scale to hundreds of skills
- **Mitigation**: All analysis skills (deep-*) are bundled directly in `skills/`. No external plugin system needed.

### A-007: Output format is JSON for machines, Markdown for LLM
- **Assumed**: Python CLI commands output Markdown (for LLM consumption), internal state is JSON
- **Why**: Proven in Skill_v1 — LLM reads Markdown better than raw JSON
- **Risk**: None — well-proven pattern

### A-008: Windows compatibility required
- **Assumed**: Must work on Windows (user's environment is Windows 11)
- **Why**: Current development environment
- **Impact**: UTF-8 workarounds, path handling, no Unix-specific features
- **Applied**: All Python files include the win32 UTF-8 reconfigure block

### A-009: Deep-* skills don't need full S2 format
- **Assumed**: Adapted skills (deep-*) follow lighter S2.1 format — frontmatter + procedure + Forge Integration, without Read/Write Commands tables, Output table, etc.
- **Why**: Deep-* skills are analysis methodology guides, not Forge I/O procedures. The `/discover` skill (native S2) is the bridge.
- **Risk**: Lower discoverability of what deep-* skills read/write
- **Mitigation**: Documented in STANDARDS.md S2.1
- **Added in**: v1.1

### A-010: Atomic writes prevent JSON corruption
- **Assumed**: `tempfile.mkstemp()` + `os.replace()` is sufficient for crash-safe writes
- **Why**: `os.replace()` is atomic on both POSIX and NTFS
- **Risk**: On network file systems (NFS, SMB) atomicity is not guaranteed
- **Mitigation**: Forge targets local filesystems. No network FS support claimed.
- **Added in**: v1.1

### A-011: Non-existent decision IDs in blocked_by_decisions don't block
- **Assumed**: If a task references `D-999` in `blocked_by_decisions` but D-999 doesn't exist, the task is NOT blocked (only OPEN decisions block)
- **Why**: Normal workflow is task-first, decision-later. A WARNING would fire falsely on freshly created tasks.
- **Risk**: Typos in decision IDs silently ignored
- **Added in**: v1.1

### A-012: Discovery findings use task_id "DISCOVERY"
- **Assumed**: All decisions recorded during `/discover` use `task_id: "DISCOVERY"` (a special ID, not a real task)
- **Why**: Discovery happens BEFORE a project has tasks. The special ID is in the allowed set alongside "PLANNING", "ONBOARDING", "REVIEW".
- **Risk**: Orphaned decisions if project is never created
- **Added in**: v1.1

### A-013: Deep-* skill bundling preserves upstream compatibility
- **Assumed**: Bundled deep-* skills can be updated by comparing `version` in frontmatter against the upstream repo (https://github.com/Deep-Process/deep-process)
- **Why**: Skills are Markdown files adapted with minimal changes (added `id`, provenance header, Forge Integration section)
- **Risk**: Upstream may restructure or rename skills
- **Mitigation**: Provenance header in each skill tracks source version. Manual diff required on update.
- **Added in**: v1.1

### A-014: Single task type per task (no multi-tagging)
- **Assumed**: Each task has exactly one `type` (feature, bug, chore, investigation). No support for multiple types.
- **Why**: Simplicity. Most tasks have a clear primary purpose.
- **Risk**: Edge cases like "bug that requires investigation" — user picks the dominant type
- **Added in**: v1.1

### A-015: Guidelines scope is open string (not enum)
- **Assumed**: Scope is a free-form string, normalized to lowercase. No closed enum.
- **Why**: Projects vary — "ml-pipeline", "mobile", "devops" can't be predicted. Suggested scopes in contract example.
- **Risk**: Inconsistent naming ("backend" vs "back-end") — mitigated by normalization and `scopes` command showing existing scopes.
- **Added in**: v1.2

### A-016: Guidelines weight controls context injection priority
- **Assumed**: `must` = always loaded to LLM context, `should` = loaded when total ≤10, `may` = titles only.
- **Why**: Prevents context window explosion while ensuring critical standards are always visible.
- **Risk**: Important `should` guidelines may be truncated in large projects
- **Mitigation**: User can promote to `must` via `guidelines update`
- **Added in**: v1.2

### A-017: Guidelines are not versioned
- **Assumed**: No version history per guideline. To change: deprecate old + create new.
- **Why**: Versioning requires snapshots, history, migration logic — overkill for standards that rarely change.
- **Risk**: No audit trail of guideline evolution
- **Mitigation**: Deprecation preserves old guideline, new one replaces it. Change can be recorded as a decision.
- **Added in**: v1.2

### A-018: Staging (ideas) layer is optional
- **Assumed**: `/plan` works without ideas. Ideas are an opt-in staging area, not a required step.
- **Why**: Don't force process — Forge is a tool, not bureaucracy. Simple tasks go directly to `/plan`.
- **Risk**: Users skip staging for complex tasks that would benefit from it.
- **Mitigation**: `/plan` can warn if a related idea exists in EXPLORING status.
- **Added in**: v1.2 (design), not yet implemented

### A-019: 'general' scope always included automatically
- **Assumed**: When loading guidelines for a task, scope "general" is always added regardless of task's explicit scopes.
- **Why**: General guidelines (error handling, naming, etc.) apply everywhere.
- **Risk**: None — user can avoid by not creating "general" scope guidelines.
- **Added in**: v1.2

### A-020: DONE tasks don't reference guidelines
- **Assumed**: Guidelines are execution context, not part of the result. DONE tasks don't track which guidelines applied.
- **Why**: Guidelines may change after task completion. Tracking would require snapshots.
- **Risk**: Can't audit which standards applied to past work. Acceptable — decisions and change records provide the audit trail.
- **Added in**: v1.2

### A-021: Ideas have enforced status transitions
- **Assumed**: Status can only change via defined transitions (DRAFT→EXPLORING, EXPLORING→READY, READY→APPROVED, etc.). COMMITTED is terminal.
- **Why**: Prevents accidental skipping of exploration phase. Forces deliberate progression.
- **Risk**: Too rigid? Mitigated by allowing EXPLORING→DRAFT ("back to drawing board") and REJECTED→DRAFT ("reopen").
- **Added in**: v1.2

### A-022: exploration_notes are append-only
- **Assumed**: When updating an idea's exploration_notes, new text is appended (separated by ---), not replaced.
- **Why**: Exploration happens in multiple rounds (deep-explore, deep-risk, deep-architect). Each round's findings should accumulate, not overwrite.
- **Risk**: Notes can grow large. Acceptable — ideas are staging, not execution context.
- **Added in**: v1.2

### A-023: Decisions can reference idea IDs as task_id
- **Assumed**: decisions.py accepts I-NNN as task_id (validated against ideas.json). This links discovery decisions to the idea being explored.
- **Why**: During `/discover I-001`, findings need a task_id. The idea ID is the natural anchor.
- **Risk**: Orphaned decisions if idea is deleted. Mitigated by: ideas are never deleted, only REJECTED.
- **Added in**: v1.2

### A-024: Idea hierarchy uses parent_id with any depth
- **Assumed**: Ideas form a tree via `parent_id`. No fixed levels (capability/module/workstream) — just parent-child. Depth is unbounded.
- **Why**: Fixed levels (A-028 considered) add complexity without value. Users can impose their own naming conventions.
- **Risk**: Very deep hierarchies may be confusing. Mitigated by: `_get_parent_chain()` shows full path.
- **Added in**: v2.0

### A-025: Relations are append-only on update
- **Assumed**: When updating idea relations via `cmd_update`, new relations are added to existing ones. Duplicate (type, target_id) pairs are silently deduplicated.
- **Why**: Prevents accidental deletion of relations. To remove a relation, user would need to reconstruct the full list.
- **Risk**: No way to remove a single relation via update. Acceptable for MVP — can add `remove_relation` command later.
- **Added in**: v2.0

### A-026: Explorations are immutable after creation
- **Assumed**: Explorations have `add`, `read`, `show` but no `update`. Once recorded, they represent a point-in-time analysis snapshot.
- **Why**: Explorations are artifacts of analysis. Modifying them would break the audit trail. New analysis = new exploration record.
- **Risk**: Typos in explorations can't be fixed. Low risk — new exploration supersedes old.
- **Added in**: v2.0

### A-027: Risk cross-validation is WARNING not ERROR
- **Assumed**: When adding a risk with `linked_entity_id`, the module warns if the entity doesn't exist but still creates the risk.
- **Why**: Risk may be identified before the idea/task is formally created. Strict validation would block legitimate workflows.
- **Risk**: Orphaned risks. Mitigated by: risks always visible in `ideas show` and `pipeline context`.
- **Added in**: v2.0

### A-028: Draft plan replaces previous draft
- **Assumed**: `draft-plan` overwrites any existing draft. Only one draft per project at a time.
- **Why**: Multiple drafts would require draft IDs, selection UI, cleanup logic — overengineering for MVP.
- **Risk**: Accidental overwrite. Low — drafts are transient, the real state is the approved pipeline.
- **Added in**: v2.0

### A-029: approve-plan marks source idea as COMMITTED
- **Assumed**: When a draft plan with `source_idea_id` is approved, the idea is automatically marked COMMITTED.
- **Why**: Two-phase flow: idea APPROVED → plan drafted → user approves plan → idea COMMITTED + tasks materialized. This is the canonical path.
- **Risk**: If approve-plan fails after marking idea COMMITTED but before saving tracker, state is inconsistent. Mitigated by: idea status change is saved first, then tracker.
- **Added in**: v2.0

### A-030: Slash commands are thin wrappers
- **Assumed**: `.claude/commands/*.md` files contain only procedure instructions (which CLI commands to call), no business logic. All logic lives in `core/*.py` modules.
- **Why**: Keeps slash commands maintainable — they're just orchestration scripts for the LLM. If logic were duplicated in markdown, it would drift from Python.
- **Risk**: None — this is the standard Claude Code pattern.
- **Added in**: v1.2

### A-031: Verification is mandatory in /next, optional standalone
- **Assumed**: Deep-verify + guidelines compliance runs automatically as Step 5 of `/next`. The `/review` command exists only for extra-thorough audits on critical tasks.
- **Why**: Making verification automatic ensures it's never skipped. Separate `/review` adds overhead for routine tasks.
- **Risk**: Verification adds latency to every task. Mitigated by: skip for trivial/chore tasks.
- **Added in**: v1.2

### A-032: Guidelines context loaded via pipeline context, not separately
- **Assumed**: `pipeline context {task_id}` loads guidelines matching task scopes (via shared `render_guidelines_context()`). No need for separate guidelines fetch during normal task execution.
- **Why**: Single command provides all context (dependencies + decisions + lessons + guidelines + risks). Reduces ceremony.
- **Risk**: If task scopes are wrong, wrong guidelines load. Mitigated by: R8 allows direct reload with explicit scopes.
- **Added in**: v1.2

### A-033: Slash command argument parsing is LLM-driven
- **Assumed**: Slash commands receive `$ARGUMENTS` as raw text. The LLM parses intent (e.g., `/ideas I-001 approve` → show idea I-001, then approve). No structured argument parsing in markdown.
- **Why**: Claude Code's slash command system passes arguments as a single string. LLM inference handles ambiguity better than rigid parsing.
- **Risk**: Misinterpretation of arguments. Low — commands are simple and well-documented with examples.
- **Added in**: v1.2

---

## Deferred Decisions

### DD-001: How to handle multi-file changes in a single task
- **Options**: (a) One change record per file, (b) One change record per logical change spanning files
- **Leaning toward**: (a) per-file, with a `group_id` linking related changes
- **Decide when**: When implementing the `implement` skill

### DD-002: How deep should reasoning traces go
- **Options**: (a) High-level only (1-3 steps), (b) Full chain-of-thought per decision
- **Leaning toward**: (b) full, but with a `detail_level` flag to control verbosity
- **Decide when**: When implementing the first real skill execution

### DD-003: ~~Should Forge manage git branches~~ RESOLVED
- **Decision**: No dedicated git wrapper. Users and Claude Code use standard git commands directly.
- **Approach**: Forge records changes via `changes diff` (which uses git) and `changes record` (manual). Branch management is left to the user/LLM — Forge doesn't abstract over git.
- **Resolved in**: v1.0 (original git_ops.py), simplified in v2.0 (removed git_ops.py)

### DD-004: ~~How to handle failed gates~~ RESOLVED
- **Decision**: Gates report pass/fail, required gates block completion advisory (LLM decides)
- **Approach**: `core/gates.py` runs configured commands, stores results on task. Required gate failure prints warning but doesn't mechanically block `pipeline complete` — the skill procedure (`skills/next/SKILL.md`) instructs the LLM to fix before completing. This keeps Python as pure I/O, LLM as judge.
- **Resolved in**: v1.0, `core/gates.py`

### DD-005: ~~Skill discovery and registration~~ SUPERSEDED
- **Original decision**: Auto-discovery from configured scan paths via `core/plugins.py`
- **Superseded by**: Bundling deep-* analysis skills directly into `skills/deep-*/`. External plugin system (`plugins.py`, `/process`, `forge_plugins.json`) removed — the primary use case (deep-process) is now built-in.
- **Resolved in**: v1.0 (original), superseded in v1.1 (bundling)

### DD-006: How to handle context window limits
- **Options**: (a) Rely on Claude Code's built-in compaction, (b) Forge-level context management
- **Leaning toward**: (a) for now, with (b) as future enhancement
- **Decide when**: When tasks start exceeding context limits in practice

### DD-007: Integration with existing project management tools
- **Options**: (a) Forge is standalone, (b) Two-way sync with Jira/GitHub Issues
- **Leaning toward**: (a) standalone first, with export capabilities
- **Decide when**: When user requirements are clearer

### DD-009: traces.py — per-task execution traces
- **Issue**: DESIGN.md mentions `core/traces.py` for aggregating execution traces, but it's not yet implemented
- **Current state**: Changes already have `reasoning_trace` per change record. The question is whether we need a separate trace aggregation module or if changes.py is sufficient.
- **Leaning toward**: Defer — changes.py covers the essential traceability. Add traces.py only if we need cross-task trace analysis.
- **Decide when**: After real-world usage reveals whether change-level traces are sufficient

### DD-010: ~~Skills directory — which skills to build first~~ RESOLVED
- **Decision**: Built plan, next (implement), and review skills
- **Skills built**: `skills/plan/SKILL.md` (goal decomposition), `skills/next/SKILL.md` (task execution with full traceability), `skills/review/SKILL.md` (structured code review)
- **Remaining**: test skill (can be added when needed, gates cover automated testing)
- **Resolved in**: v1.0

### DD-008: Change record granularity for non-code artifacts
- **Issue**: Should Forge track changes to configs, docs, tests the same as code?
- **Leaning toward**: Yes, same change records for all file types
- **Decide when**: When implementing the change tracking system

---

## Validated Assumptions (moved from Active)

(None yet — project just started)

---

## Invalidated Assumptions (moved from Active)

### ~~A-002: Git is always available~~
- **Was**: Assumed git is required
- **Reality**: Git is optional. `changes diff` requires git, but `changes record` works without it.
- **Moved**: A-002 now marked RESOLVED in Active section above

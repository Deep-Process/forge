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

### A-002: Git is always available
- **Assumed**: The working directory is a git repository
- **Why**: Change tracking relies on git diff, git log, branch management
- **Risk**: Medium — some users might use Forge without git
- **Mitigation**: Gate that checks git availability at project creation

### A-003: Python 3.10+ available
- **Assumed**: Target runtime is Python 3.10 or later
- **Why**: Using match/case, type hints, pathlib features
- **Risk**: Low — Claude Code environments typically have modern Python
- **Update**: Need to verify. If 3.9 is common, avoid match/case.

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
- **Mitigation**: Can add a skill registry later if needed

### A-007: Output format is JSON for machines, Markdown for LLM
- **Assumed**: Python CLI commands output Markdown (for LLM consumption), internal state is JSON
- **Why**: Proven in Skill_v1 — LLM reads Markdown better than raw JSON
- **Risk**: None — well-proven pattern

### A-008: Windows compatibility required
- **Assumed**: Must work on Windows (user's environment is Windows 11)
- **Why**: Current development environment
- **Impact**: UTF-8 workarounds, path handling, no Unix-specific features
- **Applied**: All Python files include the win32 UTF-8 reconfigure block

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

### DD-003: Should Forge manage git branches
- **Options**: (a) Forge creates/switches branches, (b) User manages branches, Forge just records
- **Leaning toward**: (a) Forge manages, creating a branch per project
- **Risk**: Conflicts with user's git workflow
- **Decide when**: When implementing git integration skill

### DD-004: How to handle failed gates
- **Options**: (a) Stop pipeline, require manual fix, (b) Create a decision for the failure
- **Leaning toward**: Both — stop pipeline AND create a decision record
- **Decide when**: When implementing gate infrastructure

### DD-005: Skill discovery and registration
- **Options**: (a) Skills are hardcoded in config, (b) Auto-discovered from skills/ directory
- **Leaning toward**: (b) auto-discovery with convention (directory must have SKILL.md)
- **Decide when**: When implementing the plan skill (which creates task graph)

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

### DD-010: Skills directory — which skills to build first
- **Issue**: The skills/ directory is empty. Which skills are most valuable to build first?
- **Candidates**: plan (goal decomposition), implement (code changes), review (code review), test (test execution)
- **Leaning toward**: Plan is most critical — without it, the user must manually decompose goals
- **Decide when**: After core is validated with real usage

### DD-008: Change record granularity for non-code artifacts
- **Issue**: Should Forge track changes to configs, docs, tests the same as code?
- **Leaning toward**: Yes, same change records for all file types
- **Decide when**: When implementing the change tracking system

---

## Validated Assumptions (moved from Active)

(None yet — project just started)

---

## Invalidated Assumptions (moved from Active)

(None yet — project just started)

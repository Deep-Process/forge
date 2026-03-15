# Forge CLI Reference

Full command reference for all core modules. Use `python -m core.{module} --help` for syntax.
Use `contract` subcommand for entity JSON format (e.g., `python -m core.decisions contract add`).

## Pipeline (task graph)
```
python -m core.pipeline init {project} --goal "..."      Create project
python -m core.pipeline add-tasks {project} --data '...' Add tasks (array or batch format with update_tasks)
python -m core.pipeline draft-plan {project} --data '...' [--idea I-NNN] [--objective O-NNN]  Store draft plan for review
python -m core.pipeline show-draft {project}             Show current draft plan
python -m core.pipeline approve-plan {project}           Approve draft → materialize tasks
python -m core.pipeline update-task {project} --data '{...}' Update existing task
python -m core.pipeline remove-task {project} {task_id}  Remove TODO task
python -m core.pipeline begin {project} [--agent name]   Claim next task + show full context (next + context combined)
python -m core.pipeline next {project} [--agent name]    Get next task (without context)
python -m core.pipeline complete {project} {task_id} [--force] [--reasoning "..."] [--ac-reasoning "..."]  Mark done (auto-records git changes + checks gates + verifies AC)
python -m core.pipeline contract add-tasks               Show task contract
python -m core.pipeline contract update-task             Show update contract
python -m core.pipeline contract register-subtasks       Show subtask contract
python -m core.pipeline status {project}                 Dashboard + DAG
python -m core.pipeline context {project} {task_id}      Context from deps + risks
python -m core.pipeline config {project} --data '{...}'  Set project config
```

## Decisions (unified: decisions + explorations + risks)
```
python -m core.decisions add {project} --data '...'                     Record decisions
python -m core.decisions read {project}                                  View all decisions
python -m core.decisions read {project} --status OPEN                    Open decisions
python -m core.decisions read {project} --type exploration               Explorations only
python -m core.decisions read {project} --type risk                      Risks only
python -m core.decisions read {project} --entity I-001                   By linked entity
python -m core.decisions update {project} --data '...'                   Close/defer/mitigate
python -m core.decisions show {project} {decision_id}                    Full details
python -m core.decisions contract add                                    See expected format
```

Decision types:
- **Standard**: architecture, implementation, dependency, security, performance, testing, naming, convention, constraint, business, strategy, other
- **Exploration** (type=exploration): carries findings, options, open_questions, blockers, exploration_type (domain/architecture/business/risk/feasibility)
- **Risk** (type=risk): carries severity, likelihood, linked_entity_type/id, mitigation_plan, resolution_notes

Risk status lifecycle: OPEN → ANALYZING → MITIGATED/ACCEPTED → CLOSED (can reopen)

## Changes (what was modified)
```
python -m core.changes auto {project} {task_id} --reasoning "..." [--decision_ids "D-001,D-002"] [--guidelines "G-001"]  One-step: git diff → record
python -m core.changes diff {project} {task_id}         Auto-detect changes from git (manual enrichment)
python -m core.changes record {project} --data '...'    Record file changes (full control)
python -m core.changes read {project}                   View change log
python -m core.changes summary {project}                Statistics
python -m core.changes contract                         See expected format
```

`pipeline complete` auto-records git changes (committed + uncommitted since task start). Use `--reasoning` to explain why.

## Lessons (compound learning)
```
python -m core.lessons add {project} --data '...'      Record lessons learned
python -m core.lessons read {project}                   View project lessons
python -m core.lessons read-all [--severity X] [--tags "a,b"] [--category X] [--limit N]  View lessons across all projects
python -m core.lessons promote {lesson_id} [--scope X] [--weight X]  Promote lesson to global guideline
python -m core.lessons contract                         See expected format
```

## Objectives (business goals with measurable key results)
```
python -m core.objectives add {project} --data '[...]'      Add objectives with key results
python -m core.objectives read {project} [--status X]        Read objectives
python -m core.objectives show {project} {objective_id}      Show details + coverage + progress
python -m core.objectives update {project} --data '[...]'    Update objective/KR progress
python -m core.objectives status {project}                   Coverage dashboard
python -m core.objectives contract add                       Show objective contract
```

- Key Results: measurable targets (metric + baseline + target + current)
- Ideas link to KRs via `advances_key_results: ["O-001/KR-1"]`
- `scopes`: guideline scopes — ideas can inherit these
- `derived_guidelines`: guideline IDs created BECAUSE of this objective
- `assumptions`: explicit hypotheses that must hold (from Theory of Change)
- `appetite`: effort budget — small (days), medium (weeks), large (months) (from Shape Up)
- Status lifecycle: ACTIVE → ACHIEVED | ABANDONED | PAUSED
- Coverage tracking: planning (KRs → Ideas), execution (Ideas → Tasks), outcome (KR progress)

## Ideas (staging area — hierarchical, with relations)
```
python -m core.ideas add {project} --data '[...]'                      Add ideas
python -m core.ideas read {project} [--status X] [--category X] [--parent X]  Read ideas
python -m core.ideas show {project} {idea_id}                          Show full details
python -m core.ideas update {project} --data '[...]'                   Update status/fields
python -m core.ideas commit {project} {idea_id}                        Mark APPROVED → COMMITTED
python -m core.ideas contract add                                      Show idea contract
```

- `advances_key_results`: links to objective KRs (e.g., `["O-001/KR-1"]`)
- `scopes`: can be inherited from linked objective
- Relations: depends_on, related_to, supersedes, duplicates
- Hierarchy: `parent_id` for sub-ideas

## Guidelines (project standards)
```
python -m core.guidelines add {project} --data '[...]'         Add guidelines
python -m core.guidelines read {project} [--scope X] [--weight X]  Read guidelines
python -m core.guidelines update {project} --data '[...]'      Update guideline status
python -m core.guidelines context {project} --scopes "a,b"     Guidelines for LLM context
python -m core.guidelines scopes {project}                     List unique scopes
python -m core.guidelines import {project} --source {other} [--scope X]  Import from another project
python -m core.guidelines contract add                         Show guideline contract
```

- `derived_from`: objective ID this guideline was created for
- `guidelines import`: copy between projects (dedup by title, tracks source)

## Knowledge (domain context — K-NNN)
```
python -m core.knowledge add {project} --data '[...]'              Add knowledge objects
python -m core.knowledge read {project} [--status X] [--category X] [--scope X]  Read/filter
python -m core.knowledge show {project} {knowledge_id}             Show details + version history
python -m core.knowledge update {project} --data '[...]'           Update (creates version if content changed)
python -m core.knowledge link {project} --data '{...}'             Link to entity
python -m core.knowledge unlink {project} {knowledge_id} {index}   Remove link by index
python -m core.knowledge impact {project} {knowledge_id}           Impact analysis
python -m core.knowledge contract add                              Show add contract
```

- Categories: domain-rules, api-reference, architecture, business-context, technical-context, code-patterns, integration, infrastructure
- Status lifecycle: DRAFT → ACTIVE → REVIEW_NEEDED → ACTIVE / DEPRECATED → ARCHIVED
- Versioning: content updates create new version entries (change_reason required)
- Tasks and ideas can reference knowledge via `knowledge_ids: ["K-001"]`

## Domain Modules (domain-specific guidance)
```
python -m core.domain_modules list                                               Available modules + scopes
python -m core.domain_modules get {module} --phase {phase}                       Specific phase from module
python -m core.domain_modules for-scopes --scopes "a,b" --phase {phase} [--task-type {type}]  Matching modules for scopes
python -m core.domain_modules deps {module1} {module2}                           Cross-module dependencies
```

Available modules: `ux` (frontend/ui/components), `backend` (api/server), `data` (database/schema/migration), `process` (workflow/state-machine).
Phases: `vision` (during /discover), `research` (during /discover), `planning` (during /plan), `execution` (during /next).
Complexity gate: bug/chore tasks auto-skipped via `--task-type`.

## Decision Drift Detection
```
python -m core.decision_checker check {project} [--task T-NNN]   Check locked decisions against git diff
python -m core.decision_checker report {project}                  Report all decision compliance
```

## Research (structured analysis output — R-NNN)
```
python -m core.research add {project} --data '[...]'                      Add research objects
python -m core.research read {project} [--status X] [--category X] [--entity X]  Read/filter
python -m core.research show {project} {research_id}                      Show details
python -m core.research update {project} --data '[...]'                   Update (status, findings)
python -m core.research context {project} --entity {O-001|I-001}          Research for LLM context
python -m core.research contract {name}                                   Show contract spec
```

- Categories: architecture, domain, feasibility, risk, business, technical
- Status lifecycle: DRAFT → ACTIVE → SUPERSEDED | ARCHIVED
- Links to objectives/ideas via `linked_entity_type` + `linked_entity_id`
- `decision_ids`: D-NNN IDs that originated from this research
- `key_findings`: bullet-point summary; `file_path`: path to research markdown

## AC Templates (reusable acceptance criteria — AC-NNN)
```
python -m core.ac_templates add {project} --data '[...]'                          Add templates
python -m core.ac_templates read {project} [--category X] [--scope X]             Read/filter
python -m core.ac_templates show {project} {template_id}                          Show details
python -m core.ac_templates update {project} --data '[...]'                       Update template
python -m core.ac_templates instantiate {project} {template_id} --params '{...}'  Fill in params
python -m core.ac_templates contract add                                          Show add contract
```

- Categories: performance, security, quality, functionality, accessibility, reliability, data-integrity, ux
- Status lifecycle: PROPOSED → ACTIVE → DEPRECATED
- Parameterized: templates use `{placeholder}` syntax, filled by `instantiate`

## Gates (validation checks)
```
python -m core.gates config {project} --data '[...]'   Configure test/lint gates
python -m core.gates show {project}                    Show configured gates
python -m core.gates check {project} --task {task_id}  Run all gates
python -m core.gates contract config                   Show gate contract
```

Tip: Configure secret scanning as a gate: `{"name": "secrets", "command": "gitleaks detect --no-git -v", "required": true}`

## Git Workflow (branch, worktree, PR automation)
```
python -m core.git_ops status                    Show branches and worktrees
python -m core.git_ops cleanup {project}         Clean up completed task branches/worktrees
```

Configuration (via `pipeline config`):
```json
{
  "git_workflow": {
    "enabled": true,
    "branch_prefix": "forge/",
    "use_worktrees": false,
    "worktree_dir": "forge_worktrees",
    "auto_push": true,
    "auto_pr": true,
    "pr_target": "main",
    "pr_draft": true
  }
}
```

- `pipeline next` creates branch `{prefix}{task_id}-{slug}` and optionally a worktree
- `pipeline complete` pushes branch, creates PR (if configured), cleans up worktree
- Branch-only mode (default): single-agent work in main repo
- Worktree mode (`use_worktrees: true`): multi-agent parallel work in separate directories

## Multi-Agent Support

Each agent identifies itself with `--agent {name}` on `next` and `complete`.

```bash
python -m core.pipeline next {project} --agent alice
python -m core.pipeline next {project} --agent bob
python -m core.pipeline complete {project} T-001 --agent alice
```

- Two-phase claim: CLAIMING → wait → verify → IN_PROGRESS
- `conflicts_with` enforced: conflicting tasks cannot be active simultaneously
- Without `--agent`, single-agent mode (no claim delay)

## Temporary IDs (concurrent-safe planning)

Tasks use temporary IDs (`_1`, `_2`, `_3`, ...) during planning — auto-remapped to `T-NNN` at materialize time under file lock.

- `depends_on` and `conflicts_with` can reference temp IDs within same batch
- Batch format: `{"new_tasks": [{"id": "_1", ...}], "update_tasks": [{"id": "T-003", "depends_on": ["_1"]}]}`
- Tasks modified with `update-task` (only TODO/FAILED), removed with `remove-task` (only TODO, no dependents)

## Data Encoding

Use `--data -` with heredoc for complex JSON:
```bash
python -m core.decisions add {project} --data - <<'EOF'
[{"issue": "it's a test with 'quotes' and $vars"}]
EOF
```
`<<'EOF'` passes content literally — no escaping needed. Fallback: `--data @file.json`.

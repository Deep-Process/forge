# Gap Analysis: Forge Core vs Forge Web Workflow

## Knowledge Audit

### Known Facts
- Forge Core has 7 workflow stages: objective > idea > discover > plan > next/run > complete > compound
- Forge Web has 21 API routers, 29 pages, 82 components, 37 AI tools, 24 Zustand stores
- All entity types have full CRUD in both API and UI
- AI sidebar can create/update all entities, draft plans, run gates, complete tasks
- Execution streaming exists but uses mock data, not real LLM execution
- Web has real-time WebSocket events, drag-drop, DAG visualization

### Assumptions
- Existing web codebase is stable and can be extended (not rewritten)
- AI sidebar can serve as orchestration layer with proper tools
- Execution streaming can be adapted for real task execution
- Users want visual workflow guidance, not just CLI-in-browser

### Unknown Gaps
- How should Web handle git operations (branch, worktree, PR) - these are CLI-native
- Whether Web needs its own deep-* analysis skills or delegates to AI sidebar
- How multi-agent coordination should surface in a web UI

---

## Stage-by-Stage Gap Analysis

### Stage 1: Objectives

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Add with KRs | Y | Y | Y |
| List/filter | Y | Y | Y |
| Show details | Y | Y | Y (card) |
| Update KR progress | Y | Y | Y |
| Coverage dashboard | Y | Y | X MISSING |
| Deep-align before creation | Y | N/A | X MISSING |

**Gap**: Coverage dashboard (KR > Ideas > Tasks mapping) not shown in UI. No guided creation with alignment questions.

**Priority**: MEDIUM - CRUD works, dashboard is visualization enhancement.

### Stage 2: Ideas

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Add (hierarchy, relations, advances_key_results) | Y | Y | Y |
| List/filter | Y | Y | Y |
| Show (children, decisions, scope inheritance) | Y | Y | X detail view incomplete |
| Update/commit | Y | Y | Y |

**Gap**: Detail view doesn't show hierarchy, related decisions, or scope inheritance context.

**Priority**: LOW - mostly UI polish.

### Stage 3: Discovery (/discover)

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Research objects (R-NNN) | Y | X NO ROUTER | X NO UI |
| Deep-explore analysis | Y | X | X |
| Deep-risk assessment | Y | X | X |
| Deep-architect design | Y | X | X |
| Deep-feasibility check | Y | X | X |
| Research file persistence | Y | X | X |

**Gap**: ENTIRE SUBSYSTEM MISSING. No research router, no research UI, no research objects.
This blocks the complete /discover workflow.

**Priority**: CRITICAL - discovery is foundational to the Forge process.

### Stage 4: Planning (/plan)

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Add tasks | Y | Y | Y |
| Draft plan (two-phase) | Y | X MISSING from REST | X MISSING |
| Show draft | Y | X MISSING from REST | X MISSING |
| Approve plan | Y | X MISSING from REST | X MISSING |
| Deep-align on goal | Y | N/A | X |
| Complexity assessment | Y | N/A | X |

**Gap**: Two-phase draft>approve planning workflow not in REST API. AI sidebar has draftPlan/approvePlan tools but these call core Python directly, bypassing REST layer.

**Priority**: HIGH - planning without review is risky.

NOTE: AI sidebar tools draftPlan, showDraft, approvePlan exist and call core.pipeline. The gap is in REST API endpoints and dedicated UI views.

### Stage 5: Task Execution (/next, /run)

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Claim next task | Y | Y (two-phase) | X NO UI BUTTON |
| Load full context | Y | Y | X not shown during execution |
| Execute with streaming | Y | Y (mock) | Y (mock) |
| Record decisions mid-task | Y | Y | X NO FORM |
| Verify guidelines compliance | Y | X | X |
| Verify acceptance criteria | Y | X | X |
| Run gates | Y | Y (placeholder) | X |
| Record changes | Y (auto git diff) | Y (manual only) | X |
| Complete with reasoning | Y | Y | X NO BUTTON |
| Multi-agent coordination | Y | Y | X |

**Gap**: MOST CRITICAL. The execution page shows context + mock stream but has no:
- Claim button (Next Task)
- Verification panel (AC checklist + guidelines + gates)
- Decision recording form
- Change recording
- Complete button with reasoning
- Multi-agent UI

**Priority**: CRITICAL - this is the core of task execution.

### Stage 6: Completion & Changes

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Auto-record git changes | Y | X (placeholder) | X |
| Manual change recording | Y | Y | X |
| Change summary | Y | X | X |
| Gate execution | Y | X (placeholder) | X |
| AC verification | Y | X | X |

**Priority**: HIGH

### Stage 7: Compound Learning (/compound)

| Operation | Core | API | Web UI |
|-----------|------|-----|--------|
| Extract lessons from project | Y | X | X |
| Promote to guideline | Y | Y | X no UI |
| Promote to knowledge | Y | X | X |
| Cross-project lessons | Y | X | X |
| AC template pattern detection | Y | X | X |

**Priority**: MEDIUM - post-project, can be deferred.

---

## AI Sidebar Analysis

### What AI Can Do (37 tools)
- CRUD all entities (objectives, ideas, tasks, decisions, knowledge, guidelines, lessons)
- draftPlan > showDraft > approvePlan (planning workflow!)
- getTaskContext (rich context assembly)
- completeTask with reasoning
- runGates
- recordChange
- createDecision (standard, exploration, risk)
- instantiateACTemplate

### What AI Cannot Do
- /discover (no research objects, no structured exploration)
- /next + /run (no task claiming, no branch/worktree)
- /compound (no lesson extraction from completed tasks)
- /review (no deep-verify)
- /onboard (no brownfield discovery)
- /log (no audit trail view)

### Key Insight
The AI sidebar is positioned as a contextual entity assistant, not a workflow orchestrator. It can create things but can't guide through multi-step processes like Core's slash commands do.

---

## Web-Only Capabilities (Core Doesn't Have)

1. Real-time WebSocket updates - entity changes broadcast instantly
2. Drag-and-drop entity relations - visual relationship building
3. Task DAG visualization - graphical dependency view
4. AI sidebar with page context - knows what user is looking at
5. Session management - persistent chat history with scope awareness
6. Debug tools - API inspector, LLM monitor, event stream
7. Visual entity cards - status, progress, metadata at a glance
8. Command palette - quick access to actions

These should be LEVERAGED, not abandoned.

---

## Priority Matrix

### CRITICAL (Blocks core workflow)
1. Research router + UI (enables /discover)
2. Task execution flow (claim > context > verify > complete)
3. Draft-plan/approve-plan REST endpoints + UI

### HIGH (Significantly reduces value)
4. Context display during execution
5. Verification panel (AC + guidelines + gates)
6. Decision recording during task execution
7. Change recording (at minimum manual, ideally auto)

### MEDIUM (Missing features, not blocking)
8. Objectives coverage dashboard
9. Compound learning workflow
10. Gates management UI
11. Multi-agent coordination UI

### LOW (Polish)
12. Ideas detail view enhancement
13. Knowledge link/unlink UI
14. Decision type/entity filters
15. AC template instantiation in task forms
16. Lessons creation form

---

## What Was NOT Explored
- Performance implications of real-time context assembly
- Mobile/responsive considerations for workflow UI
- Specific LLM provider capabilities affecting execution
- Data migration from existing mock data
- Testing strategy for workflow UI
# Web Workflow Architecture: Adapting Forge Core for Web UI

## Overview

Forge Core's workflow (objective > idea > discover > plan > next/run > complete > compound) must be adapted for the Web Platform. This is NOT a CLI-in-browser port. The Web should leverage its unique strengths (visual, interactive, real-time) while preserving Core's orchestration value (context assembly, verification, traceability).

## Requirements & Constraints

### Functional Requirements
1. Users can execute the full Forge workflow through the Web UI
2. Each workflow stage has appropriate visual representation
3. AI sidebar can orchestrate complex multi-step processes
4. Task execution includes context loading, verification, and completion
5. All Forge entities have proper CRUD + workflow actions

### Constraints
- Tech stack: FastAPI + Next.js + Zustand (unchanged)
- Forge Core Python modules are the source of truth for business logic
- 37 existing AI tools must be preserved and extended
- Existing 82 components and 29 pages should be reused/extended, not rewritten

### Quality Attributes
- Real-time: entity changes reflect immediately via WebSocket
- Traceable: every workflow action recorded (decisions, changes)
- Guided: UI helps users follow the right process
- Flexible: users can skip stages when appropriate

---

## Architecture Decision Records

### ADR-1: Hybrid UI+AI Workflow Approach

**Context**: Should the Web use UI-driven workflows (wizards), AI-driven workflows (chat), or both?

**Decision**: Hybrid approach with clear division:
- **UI buttons/views** for structured, predictable workflows: claim task, show context, verify AC, run gates, complete task, create/approve plan
- **AI sidebar** for complex, analytical workflows: /discover (multi-skill orchestration), /compound (lesson extraction), /review (deep-verify)
- **Both available** for entity creation: UI forms for quick CRUD, AI for guided creation with alignment

**Alternatives considered**:
- UI-only: Too rigid for discovery/analysis workflows
- AI-only: Too opaque for structured task execution; users need visual confirmation
- CLI-in-browser: Defeats the purpose of having a Web UI

**Consequences**:
- (+) Each workflow uses the best modality
- (+) Users can choose their preferred interaction style
- (-) Two paths to learn
- (-) Must keep UI and AI in sync

### ADR-2: Task Execution Page Redesign

**Context**: Current execution page is a mock stream viewer. Need a full task execution interface.

**Decision**: Redesign execution page with 5 integrated panels:

```
+------------------------------------------+
|  Task Header: T-001 name [IN_PROGRESS]   |
|  Origin: I-001 > O-001 (KR progress)     |
+------------------------------------------+
| Context Panel    |  Execution Panel       |
| (expandable)     |  (main area)           |
|                  |                        |
| - Task brief     |  [AI chat/stream]      |
| - Guidelines     |  or                    |
|   (MUST/SHOULD)  |  [Manual work area]    |
| - Knowledge      |                        |
| - Dependencies   |                        |
| - Risks          |                        |
| - Business ctx   |                        |
+------------------+------------------------+
| Decision Panel   |  Verification Panel    |
| (collapsible)    |  (pre-completion)      |
|                  |                        |
| + Add Decision   |  [ ] AC-1: criterion   |
| D-001 CLOSED     |  [ ] AC-2: criterion   |
| D-002 OPEN       |  [ ] G-001 compliant   |
|                  |  [ ] Gates: PASS       |
|                  |  [Complete Task]       |
+------------------+------------------------+
```

Flow:
1. User clicks "Claim Next Task" from task list or sidebar
2. System claims via two-phase lock, redirects to execution page
3. Context panel loads automatically (guidelines, knowledge, deps, risks, business)
4. User works in execution panel (AI chat or manual)
5. User records decisions if needed (decision panel)
6. Before completion: verification panel shows AC checklist + guideline compliance + gate results
7. User provides reasoning and clicks "Complete Task"

**Alternatives considered**:
- Separate pages for each step: Too fragmented, loses context
- Single-panel: Not enough information density for complex tasks
- Tab-based: Hides important information

**Consequences**:
- (+) All task context visible at once
- (+) Natural flow from context > execute > verify > complete
- (-) Complex page with many components
- (-) Needs responsive design for smaller screens

### ADR-3: Research Router for /discover Support

**Context**: /discover needs Research objects (R-NNN) but no REST router exists.

**Decision**: Create REST router mirroring core.research interface:
- POST /research - create research objects (with content field for file writing)
- GET /research - list (with status, category, entity filters)
- GET /research/{id} - show details
- PATCH /research/{id} - update (status, decision_ids)
- GET /research/context?entity={id} - research for entity context

Also add a Research UI page:
- List research objects with linked entities
- Show full research content (rendered markdown)
- Link to related decisions

**Consequences**:
- (+) Enables /discover through AI sidebar
- (+) Research visible and browsable in UI
- (-) Another router/page to maintain

### ADR-4: Planning View with Draft-Approve Flow

**Context**: Planning needs two-phase draft>approve workflow.

**Decision**: Add REST endpoints and UI view:

API:
- POST /tasks/draft-plan - create draft plan (stores in tracker.json)
- GET /tasks/draft - show current draft
- POST /tasks/approve-plan - materialize draft to pipeline
- DELETE /tasks/draft - discard draft

UI:
- "Create Plan" button on project page triggers AI sidebar with draftPlan
- Draft preview shows task list with dependencies as DAG
- User can edit individual tasks in draft before approving
- "Approve Plan" and "Discard" buttons
- After approval, tasks appear in pipeline view

**Consequences**:
- (+) Visual plan review before committing
- (+) DAG visualization of proposed task graph
- (-) Need to handle draft state in UI (only one draft at a time)

### ADR-5: Workflow Progress Indicator

**Context**: Users need to know where they are in the Forge process.

**Decision**: Add a workflow status bar to project layout showing the current stage:

```
[Objective] > [Ideas] > [Discovery] > [Plan] > [Execute] > [Learn]
    done       2 ideas    1 research   draft     3/8 tasks   pending
```

Each stage clickable, shows:
- Completion status (items done/total)
- Blocked items (e.g., open decisions blocking plan)
- Suggested next action

**Consequences**:
- (+) Users always know where they are
- (+) Natural guidance through the process
- (-) Must track stage completion heuristically

---

## Component Architecture

### New API Endpoints Needed

| Router | Endpoint | Method | Purpose |
|--------|----------|--------|--------|
| research | /research | POST | Create research objects |
| research | /research | GET | List with filters |
| research | /research/{id} | GET | Show details |
| research | /research/{id} | PATCH | Update status/decisions |
| research | /research/context | GET | Research for entity |
| tasks | /tasks/draft-plan | POST | Create draft plan |
| tasks | /tasks/draft | GET | Show current draft |
| tasks | /tasks/approve-plan | POST | Materialize draft |
| tasks | /tasks/draft | DELETE | Discard draft |

### New/Modified UI Components

| Component | Type | Purpose |
|-----------|------|--------|
| WorkflowProgressBar | New | Show current stage in project layout |
| TaskClaimButton | New | Claim next task from task list |
| TaskExecutionPage (v2) | Rewrite | 5-panel execution interface |
| ContextPanel | New | Expandable context sections with token counts |
| VerificationPanel | New | AC checklist + guidelines + gates |
| DecisionRecordForm | New | Quick decision recording during execution |
| CompletionDialog | New | Reasoning input + summary before completing |
| DraftPlanView | New | Draft preview with DAG + edit + approve |
| ResearchListPage | New | Research objects list |
| ResearchDetailPage | New | Rendered research markdown + decisions |
| ObjectiveCoverageDashboard | New | KR > Ideas > Tasks coverage view |

### New AI Sidebar Tools Needed

| Tool | Scope | Purpose |
|------|-------|---------|
| createResearch | research | Create R-NNN objects |
| updateResearch | research | Update status, add decision_ids |
| listResearch | research | List/filter research |
| getResearchContext | research | Research for entity context |
| claimNextTask | execution | Claim next available task |
| runDiscovery | discovery | Orchestrate deep-explore/risk/architect |
| extractLessons | learning | /compound equivalent |
| getAuditTrail | audit | /log equivalent |

---

## Workflow Adaptation: Core vs Web

### How Each Stage Maps

| Core Stage | Core Experience | Web Adaptation |
|------------|----------------|----------------|
| /objective | Interactive Q&A in CLI | UI form + optional AI alignment in sidebar |
| /idea | CLI with deep-align | UI form + AI sidebar for guided exploration |
| /discover | Multi-skill orchestration in CLI | AI sidebar orchestrates, results shown in Research page |
| /decide | CLI review of open decisions | Decision list page with filters + status actions |
| /plan | CLI draft>review>approve | Draft view with DAG visualization + approve button |
| /next | CLI claims + full context dump | Claim button > Execution page with visual context |
| /run | CLI loop: next>execute>complete | Run button: automated loop with progress dashboard |
| /complete | CLI with reasoning + gates | Verification panel > completion dialog |
| /compound | CLI lesson extraction | AI sidebar extracts, results shown in Lessons page |

### What Web Does BETTER Than Core

1. **Visual context**: Expandable panels > raw text dump
2. **DAG visualization**: See dependencies graphically > ASCII tree
3. **Real-time updates**: WebSocket > re-run command
4. **Parallel awareness**: See all active tasks > one terminal per agent
5. **Coverage dashboard**: Visual KR>Idea>Task mapping > text report
6. **Drag-drop relations**: Visual linking > JSON arrays
7. **Integrated AI**: Sidebar context-aware > separate LLM session

### What Core Does That Web Should NOT Replicate

1. **Git branch/worktree creation**: Web should track but not create branches
2. **Direct file editing**: Web is oversight layer, not IDE
3. **deep-* skill execution as CLI**: Web delegates to AI sidebar
4. **Automated PR creation**: Web can link to PRs but not create them

---

## Implementation Phases

### Phase 1: Foundation (enables basic workflow)
1. Research router + UI page (enables /discover data storage)
2. Draft-plan REST endpoints (enables two-phase planning)
3. Task claim button in UI (enables /next entry point)
4. Execution page context panel (shows loaded context)

### Phase 2: Execution Flow (enables task completion)
5. Verification panel (AC + guidelines + gates)
6. Decision recording during execution
7. Completion dialog with reasoning
8. Change recording (manual)

### Phase 3: Orchestration (enables AI-driven workflows)
9. AI sidebar research tools
10. AI sidebar discover orchestration
11. Workflow progress bar
12. Objectives coverage dashboard

### Phase 4: Advanced (enables full parity)
13. Compound learning via AI sidebar
14. Gates management UI
15. Multi-agent coordination UI
16. Run mode (automated task loop)

---

## Tradeoffs

| Chose | Over | Because | Lost | Gained |
|-------|------|---------|------|--------|
| Hybrid UI+AI | Pure UI | Discovery/compound too complex for forms | Unified UX | Best modality per workflow |
| 5-panel execution | Separate pages | Context visibility during work | Simplicity | Information density |
| REST endpoints for research | AI-only research | Enables browsing, filtering, linking | Less code | Full CRUD + visibility |
| Reuse existing components | Rewrite | 82 components already built | Fresh start | Speed, consistency |
| Phase delivery | Big bang | Risk mitigation, incremental value | Complete vision upfront | Usable at each phase |
---
name: sidebar-ai-context
id: SKILL-SIDEBAR-AI-CONTEXT
version: "1.1"
description: "Entity-scoped AI sidebar with context binding, context extension, and auto-attached entity skills."
entity_types: [objective, idea, task, decision, guideline, knowledge, research]
scopes: [frontend, backend, ai, llm, skills]
---

# Sidebar AI Context

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-SIDEBAR-AI-CONTEXT |
| Version | 1.1 |
| Description | Entity-scoped AI conversations with context binding, user-driven context extension, and auto-attached entity skills. Covers O-009, O-012, O-013. |

## Objectives Covered

| Objective | Title | Appetite | Dependency |
|-----------|-------|----------|------------|
| O-009 | Entity-Scoped AI Conversations | medium | foundation — no blocker |
| O-012 | Chat Context Extension | small | depends on O-009 |
| O-013 | Entity Skill Config, Auto-Attach & Base Skills | medium | depends on O-009 |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + React 18 + Zustand)             │
│                                                          │
│  DAG Node ──┐                                            │
│  URL Auto ──┼── triggers ──→ Sidebar                     │
│  (Detail) ──┘                │                           │
│                               ▼                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │ AI Sidebar (AISidebar.tsx)                       │    │
│  │  ┌─ Entity badge (inline, lines 860-880)        │    │
│  │  ├─ AddContextButton.tsx (searchable dropdown)  │    │
│  │  │    └─ AdditionalContextChips (inline 667-695)│    │
│  │  ├─ ConversationsTab (entity-filtered, 425-606) │    │
│  │  ├─ TokenCounter (used / budget, color-coded)   │    │
│  │  ├─ WorkflowProgress (if workflow session)      │    │
│  │  └─ [MISSING] SkillPicker / auto-attach logic   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  sidebarStore.ts (Zustand):                              │
│    targetEntity: TargetEntity | null          ✓ BUILT    │
│    additionalContexts: AdditionalContext[]    ✓ BUILT    │
│    entityDefaultScopes: string[]              ✓ BUILT    │
│    pendingSkillPick: string[] | null          ✗ UNUSED   │
│    aiChooseSkill: boolean                     ✗ UNUSED   │
│    addedScopes / removedScopes               ✓ BUILT    │
│    attachedSkills: AttachedSkillInfo[]        ✓ BUILT    │
└──────────────────┬───────────────────────────────────────┘
                   │ POST /llm/chat
                   │ { target_entity, additional_contexts }
                   ▼
┌──────────────────────────────────────────────────────────┐
│  Backend (FastAPI + Python 3.11 + Redis Stack 7.4)       │
│                                                          │
│  ChatRequest                                             │
│    target_entity_type + target_entity_id     ✓ BUILT     │
│    additional_contexts: [{type, id}]         ✓ BUILT     │
│                                                          │
│  context_resolver.py                         ✓ BUILT     │
│    Resolvers: skill, task, objective, idea,              │
│               knowledge, global, generic                 │
│    Generic fallback: decision, guideline,                │
│                      lesson, change, ac_template         │
│    ~500 tokens per entity, MAX_CONTENT 8000              │
│                                                          │
│  llm_chat.py                                 ✓ BUILT     │
│    Resolves additional_contexts (max 5)                   │
│    Injects as "### {Type} {ID}\n\n{context}"             │
│                                                          │
│  ContextWindowManager                        ✓ BUILT     │
│    Pin last 5 tool results + summary every 10 msgs       │
│    Sliding window, 30k token budget                      │
│                                                          │
│  entity_skills config (project_config)       ✓ BUILT     │
│    {objective: [...], idea: [...], task: [...]}           │
│    Settings UI: EntitySkillsSection          ✓ BUILT     │
│    Backend validation on save                ✓ BUILT     │
│                                                          │
│  entity_type_defaults config                 ✓ BUILT     │
│    Per entity type default scopes                        │
└──────────────────────────────────────────────────────────┘
```

## Implementation Status

### DONE — Fully Implemented

| Feature | Location | Notes |
|---------|----------|-------|
| Entity binding (URL auto-detect) | `AISidebar.tsx:735-752` | Regex matches `/projects/{slug}/{entityPlural}/{id}` → `setTargetEntity()` |
| Entity binding (DAG context menu) | `NodeContextMenu.tsx` | Right-click → "AI Assistant" → `setTargetEntity()` |
| Entity badge in sidebar | `AISidebar.tsx:860-880` | Inline div — shows type badge, label, ID, clear button |
| AddContextButton | `AddContextButton.tsx` | Searchable dropdown, debounce 250ms, grouped by type, dedup, max 5 |
| AdditionalContextChips | `AISidebar.tsx:667-695` | Inline — color-coded chips, removable, entity type abbreviation |
| ConversationsTab (entity filtering) | `AISidebar.tsx:425-606` | Toggle All/Entity view, filters via `llm.listSessions({entity_type, entity_id})` |
| Entity type default scopes | `AISidebar.tsx:754-766` | Reads `project.config.entity_type_defaults`, applies via `setEntityDefaultScopes()` |
| Scopes tab "(default)" badge | `AISidebar.tsx:138-419` | Shows which scopes are from entity defaults |
| Entity skills config (Settings UI) | `settings/page.tsx:155-304` | `EntitySkillsSection` — assign/remove skills per entity type |
| Entity skills config (Backend) | `projects.py` | Validates skill references on save |
| additional_contexts in chat | `LLMChat.tsx` + `llm_chat.py` | Frontend sends, backend resolves each via `context_resolver`, injects to prompt |
| context_resolver (all types) | `context_resolver.py` | Dedicated resolvers: skill, task, objective, idea, knowledge, global + generic fallback |
| sidebarStore (all fields) | `sidebarStore.ts` | `targetEntity`, `additionalContexts`, `entityDefaultScopes`, `pendingSkillPick`, `aiChooseSkill` |
| SlashCommandRouter | T-043 DONE | Maps `/command` to skill + session_type |
| WorkflowStateMachine | T-044 DONE | Soft enforcement, step tracking |
| ContextWindowManager | T-045 DONE | Hybrid pinning, 30k budget |
| EntityInlineCard | T-046 DONE | Regex detection, clickable cards |
| Tool descriptions | T-047 DONE | `ENTITY:` prefix on create/update tools |
| Session type guidance | T-048 DONE | `_SESSION_GUIDANCE` per session type |
| WorkflowProgress UI | T-049 DONE | Step indicator in sidebar |
| TokenCounter UI | T-050 DONE | Used/budget with color coding |

### DEFINED BUT NOT WIRED — Store Fields Without Logic

| Field | Location | Issue |
|-------|----------|-------|
| `pendingSkillPick: string[] \| null` | `sidebarStore.ts:55` | Never set or read — no UI triggers it |
| `aiChooseSkill: boolean` | `sidebarStore.ts:57` | Never set or read — no logic consumes it |

### NOT BUILT — Remaining Work

| Feature | Objective | Description |
|---------|-----------|-------------|
| **Skill auto-attach on entity bind** | O-013 | When `targetEntity` is set, look up `entity_skills[type]` from config and auto-attach (1 skill) or show picker (2+ skills). Currently: user must manually attach skills via Tools tab. |
| **SkillPicker component** | O-013 | UI for choosing between multiple skills when entity type has >1 assigned. Currently: no component exists. |
| **"AI choose" logic** | O-013 | Backend flow: send skill descriptions to LLM, LLM picks best match, inject selected skill. Currently: `aiChooseSkill` flag exists in store but nothing reads it. |
| **Explicit "AI Assistant" button on detail pages** | O-009 | Entity detail page headers have no dedicated button. Currently: binding works only via URL auto-detect (navigating to page) or DAG right-click. Not blocking — auto-detect covers the use case, but explicit button improves discoverability. |
| **Session TTL extension to 7-30 days** | O-009 | Verify SessionManager Redis TTL is extended from default 24h. May already be configured — needs verification. |

### Base Entity Skills — Deployed as Global Skills

Three starter skills were created (T-084) and exist as **deployed global skills** in:

```
forge_output/_global/skills/objective-definer/SKILL.md
forge_output/_global/skills/idea-explorer/SKILL.md
forge_output/_global/skills/task-executor/SKILL.md
```

These were **removed from** `skills/` source directory (commit `2dd2be19`) because they live as platform-managed skills, not as Forge CLI source files.

| Skill | entity-types | contract-refs | Purpose |
|-------|-------------|---------------|---------|
| objective-definer | `[objective]` | `objectives/add`, `objectives/update` | Define objectives with measurable KRs |
| idea-explorer | `[idea]` | `ideas/add`, `ideas/update` | Explore, refine, structure ideas with relations and KR links |
| task-executor | `[task]` | `pipeline/add-tasks`, `pipeline/update-task` | Guide task execution with AC verification |

These skills use REST API contract endpoints (`GET /api/v1/contracts/{ref}`) not CLI `python -m core.* contract` commands. They are consumed by the forge-web LLM sidebar, not by Claude Code.

---

## Remaining Implementation Guide

### Phase A — Skill Auto-Attach (O-013, primary gap)

The entity_skills config is built, the store fields exist, the skills are deployed. What's missing is the **wiring logic** that connects them.

**Step 1 — Auto-attach on targetEntity change** (`AISidebar.tsx`):

Add a `useEffect` that triggers when `targetEntity` changes:

```
When targetEntity is set:
  1. Read entity_skills from project config
  2. Get skills for targetEntity.type
  3. If 0 skills → do nothing (plain chat)
  4. If 1 skill → auto-call attachSkill(name, display_name)
  5. If 2+ skills → set pendingSkillPick to skill names
```

Place this near the existing `useEffect` for entity_type_defaults (lines 754-766).

**Step 2 — SkillPicker component** (new file):

When `pendingSkillPick` is not null, render a picker:
- Dropdown or inline radio group below the entity badge
- Each option: skill name + 1-line description (from skill metadata)
- "AI choose" option → sets `aiChooseSkill: true`
- On selection: call `attachSkill()`, clear `pendingSkillPick`

**Step 3 — "AI choose" flow** (`LLMChat.tsx` + `llm_chat.py`):

When `aiChooseSkill` is true on message send:
- Frontend: include all candidate skill descriptions in the request
- Backend: prepend a meta-prompt: "Choose the most relevant skill for this entity"
- LLM responds with skill selection + reasoning
- Backend injects the selected skill into the session
- Frontend: call `attachSkill()` with LLM's choice, set `aiChooseSkill: false`

### Phase B — Detail Page AI Button (O-009, nice-to-have)

Currently entity binding works via URL auto-detect — opening an entity detail page automatically binds the sidebar. An explicit "AI Assistant" button would improve discoverability but is not functionally blocking.

If implemented:
- Add a button/icon to entity detail page headers (near edit/delete actions)
- On click: ensure sidebar is open + call `setTargetEntity()`
- Same as what auto-detect already does, but gives the user an explicit affordance

### Phase C — Session TTL Verification (O-009, verification only)

Verify that `SessionManager` Redis TTL is configured for 7-30 days instead of default 24h. Check:
- `forge-api/app/llm/session_manager.py` (or equivalent)
- Redis TTL setting for chat sessions
- If still 24h → extend to 7 days minimum

---

## ADRs (Architecture Decision Records)

Decisions already recorded (D-026 through D-028). Follow them — do NOT redesign.

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-1 | SlashCommandRouter in frontend, maps `/command` to `{skill, session_type}` | DONE (T-043) |
| ADR-2 | WorkflowStateMachine on backend ChatSession, soft enforcement | DONE (T-044) |
| ADR-3 | ContextWindowManager: pin last 5 tool results + summary every 10 msgs + sliding window, 30k budget | DONE (T-045) |
| ADR-4 | EntityInlineCard: regex post-processing for `T-/D-/O-/I-/K-/G-/R-/L-/AC-` patterns | DONE (T-046) |
| ADR-5 | Archive/remove semantics only — no hard DELETE via sidebar | Decided |

## Risk Mitigations

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| LLM Tool Confusion (42+ tools) | HIGH (18) | `ENTITY:` prefix on tools | DONE (T-047) |
| Data Loss from DELETE | HIGH (16) | Archive/remove only (ADR-5) | Decided |
| Context Window Exhaustion | HIGH (15) | ContextWindowManager + max 5 additional contexts + TokenCounter | DONE (T-045, T-050) |
| Slash Command Ambiguity | MEDIUM (14) | SlashCommandRouter with skill descriptions | DONE (T-043) |
| Workflow State Drift | MEDIUM (14) | WorkflowStateMachine soft enforcement | DONE (T-044) |

## DO NOT Modify

- `EntityInlineCard` behavior (display-only @mentions — T-046)
- `SlashCommandRouter` mapping (T-043)
- `WorkflowStateMachine` logic (T-044)
- `ContextWindowManager` algorithm (T-045)
- `TokenCounter` UI (T-050)
- Base entity skills in `forge_output/_global/skills/` (platform-managed)

## Key File Reference

| File | Role |
|------|------|
| `forge-web/stores/sidebarStore.ts` | All sidebar state — entity binding, contexts, skills, scopes |
| `forge-web/components/ai/AISidebar.tsx` | Main sidebar component — entity badge, chips, conversations, scopes |
| `forge-web/components/ai/AddContextButton.tsx` | Searchable entity dropdown for adding context |
| `forge-web/components/ai/LLMChat.tsx` | Chat message sending — includes additional_contexts |
| `forge-web/components/graph/NodeContextMenu.tsx` | DAG right-click menu with "AI Assistant" option |
| `forge-web/app/projects/[slug]/settings/page.tsx` | EntitySkillsSection — entity_skills config UI |
| `forge-api/app/llm/context_resolver.py` | Entity context resolution — per-type resolvers + generic fallback |
| `forge-api/app/routers/llm_chat.py` | Chat handler — resolves target entity + additional contexts |
| `forge-api/app/routers/projects.py` | Project config API — entity_skills validation |

## Task Decomposition Guide

When planning remaining work (via `/plan`), only these tasks are needed:

```
Phase A (O-013) — Skill Auto-Attach (primary gap):
  _1: frontend-skill-auto-attach       (useEffect on targetEntity, reads entity_skills config)
  _2: frontend-skill-picker            (SkillPicker component, depends _1)
  _3: frontend-backend-ai-choose-skill (LLM skill selection flow, depends _2)

Phase B (O-009) — Optional polish:
  _4: frontend-detail-page-ai-button   (explicit button on entity detail headers)
  _5: backend-session-ttl-verification (verify Redis TTL 7-30 days)
```

Scopes: `_1, _2, _4`: `[frontend, ai]`; `_3`: `[frontend, backend, ai]`; `_5`: `[backend]`.

## Success Criteria

- [x] Entity binding via DAG context menu
- [x] Entity binding via URL auto-detect on detail pages
- [x] Entity badge in sidebar (type, ID, label, clear)
- [x] context_resolver handles all entity types
- [x] ConversationsTab filtered by active entity (with "show all" toggle)
- [x] Default scopes per entity type configurable and applied
- [x] "Add context" button with searchable entity dropdown
- [x] Additional contexts resolved and injected (max 5)
- [x] Context chips with removal (display-only @mention unchanged)
- [x] entity_skills mapping in project config with validation + Settings UI
- [x] 3 base entity skills deployed (objective-definer, idea-explorer, task-executor)
- [x] Token counter warns at 80% budget
- [x] No hard DELETE — archive/remove only
- [ ] Skill auto-attach on entity bind (1 skill → auto, 2+ → picker)
- [ ] SkillPicker component for multi-skill entity types
- [ ] "AI choose" option (LLM selects best skill from candidates)
- [ ] Explicit "AI Assistant" button on entity detail pages (optional — auto-detect works)
- [ ] Session TTL verified at 7-30 days

## References

- `forge_output/forge-web/objectives.json` — O-009, O-012, O-013 definitions
- `forge_output/forge-web/research/deep-explore-entity-management-via-ai-sidebar---option-exploration.md`
- `forge_output/forge-web/research/deep-architect-entity-management-via-ai-sidebar---architecture-design.md`
- `forge_output/forge-web/research/deep-risk-entity-management-via-ai-sidebar---risk-assessment.md`
- `forge_output/forge-web/research/deep-feasibility-entity-management-via-ai-sidebar---feasibility-assessment.md`
- `forge_output/forge-web/decisions.json` — D-026 (slash router), D-027 (workflow SM), D-028 (context manager)
- `forge_output/_global/skills/` — deployed base entity skills (objective-definer, idea-explorer, task-executor)

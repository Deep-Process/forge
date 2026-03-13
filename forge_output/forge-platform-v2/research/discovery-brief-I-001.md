# Discovery Brief: I-001 — Przebudowa UI Forge Platform
Date: 2026-03-11T15:30:00Z
Skills: deep-explore, deep-risk, deep-architect

---

## Orchestration Summary

| Skill | Status | Key Finding |
|-------|--------|-------------|
| deep-explore | DONE | **Option B recommended**: Layout Redesign + Incremental. Fix shell first (sidebar, bottom panel, routes), then add features. Existing code (stores, API client, cards) reuses 100%. |
| deep-risk | DONE | **15 risks identified**, top: State Management Explosion (29), Form Validation Divergence (26), WS Race Conditions (26). Central reinforcing loop found. |
| deep-architect | DONE | **6 ADRs proposed**: Grouped sidebar, debug bottom panel, form drawer, SWR+Zustand hybrid, WS→SWR revalidation, EntityLink component. C4 diagrams provided. |

## Recommended Direction

**Layout Redesign + Incremental Enhancement** (Option B). Fix the structural bottleneck (navigation, layout containers) in 2-3 tasks, then incrementally build features within the new shell. This approach:

1. Preserves all existing working code (~4000 LOC of stores, API client, cards, hooks)
2. Fixes the root cause (flat 13-tab navigation can't scale to detail views + debug panel)
3. Enables 3-click workflows (sidebar → entity → action)
4. Creates the container for debug console (persistent bottom panel)
5. Establishes patterns for all subsequent feature work

**Before any feature work**, invest in infrastructure:
- Split entityStore into per-entity stores (mitigates D-005, composite 29)
- Add SWR for data fetching (ADR-005)
- Add vitest + testing-library (mitigates D-008, composite 24)

**Execution order** (risk-informed):
```
Phase 0: Infrastructure (store split, SWR, vitest)
Phase 1: Layout Shell (sidebar, bottom panel, routes)
Phase 2: I-003 Entity CRUD Forms (highest value, unblocks I-004)
Phase 3: I-004 Detail Views + Navigation
Phase 4: I-007 Real-time Updates
Phase 5: I-002 Dashboard Command Center
Phase 6: I-005 Pipeline/Board Views
Phase 7: I-008 Debug Console (after real-time works)
Phase 8: I-006 Settings (lowest risk, slots anywhere)
```

## Key Architecture Decisions (6 ADRs)

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-001 | Grouped sidebar nav (5 groups: Planning, Execution, Quality, Knowledge, Audit) | PROPOSED |
| ADR-002 | Debug console as resizable bottom panel (React Portal) | PROPOSED |
| ADR-003 | Form drawer pattern (slide-in right, 480px) with EntityRefField autocomplete | PROPOSED |
| ADR-004 | WS events → SWR revalidation (not in-memory merge) | PROPOSED |
| ADR-005 | Zustand (mutations/UI) + SWR (reads) hybrid state management | PROPOSED |
| ADR-006 | EntityLink component for cross-entity navigation with hover preview | PROPOSED |

## Open Decisions (12 requiring review)

| ID | Type | Issue | Severity |
|----|------|-------|----------|
| D-001 | exploration | Architecture: Option B recommended | — |
| D-002 | risk | Performance with large entity lists | MEDIUM |
| D-003 | risk | fetch() monkey-patching conflicts with Next.js | MEDIUM |
| D-004 | risk | Layout redesign may break existing pages | LOW |
| D-005 | risk | State management explosion (entityStore → 1000+ LOC) | HIGH |
| D-006 | risk | Form validation divergence (TS types vs Pydantic) | HIGH |
| D-007 | risk | WebSocket race conditions (3 update paths) | HIGH |
| D-008 | risk | No testing infrastructure (0 tests) | HIGH |
| D-009 | risk | Backend API gaps (PATCH /projects, activity feed) | MEDIUM |
| D-010 | risk | Debug console performance (payload capture + rendering) | MEDIUM |
| D-011 | risk | Missing form library (6 complex forms from scratch) | MEDIUM |
| D-012 | risk | Scope creep via UI perfectionism | MEDIUM |

## Top 5 Risks to Accept/Mitigate

| # | Risk | Score | Mitigation |
|---|------|-------|------------|
| 1 | **State explosion** (D-005) | 29 | Split entityStore before I-003. Per-entity stores with factory pattern. |
| 2 | **Form validation divergence** (D-006) | 26 | Generate types from OpenAPI spec. Add zod schemas. |
| 3 | **WS race conditions** (D-007) | 26 | SWR revalidation pattern (ADR-004). Dedup window for mutations. |
| 4 | **No tests** (D-008) | 24 | Add vitest before overhaul. 1 test per store slice + validation fn. |
| 5 | **API gaps** (D-009) | 22 | Audit needed endpoints before each sub-idea. Add PATCH /projects. |

## New Dependencies (justified)

| Package | Size | Justification |
|---------|------|---------------|
| swr | 4.4kb | Replaces ~200 LOC manual cache/loading/error. Auto-revalidation, deduplication. |
| react-hotkeys-hook | 1.2kb | Keyboard shortcuts (Cmd+K, Escape). |
| react-hook-form + zod | ~12kb | 6 entity forms × 5-15 fields. Cuts form code by 60%. |
| vitest + testing-library | dev only | Zero test coverage → basic safety net. |
| Total runtime | ~18kb | Bundle: ~140kb → ~158kb. Within 200kb budget. |

## Next Steps

- [ ] Review and close/accept OPEN decisions with `/decide`
- [ ] When ready: `/plan I-001` to decompose into task graph
- [ ] Or: deeper analysis on specific sub-idea with `/discover I-00N`

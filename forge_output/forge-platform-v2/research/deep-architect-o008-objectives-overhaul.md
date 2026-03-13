# Deep-Architect Analysis: O-008 Objectives Module Overhaul
Date: 2026-03-11T22:30:00Z
Skill: deep-architect v1.0
Decision: D-016 (architecture)

---

## ADR-1: Descriptive KR Schema → Option A (optional description field)
- Add optional `description` alongside metric/baseline/target/current
- Validation: either `metric` OR `description` must be present
- Progress: numeric KRs show %, descriptive show status badge
- Backward compatible: existing KRs unchanged

## ADR-2: LLM Enrichment → Option C (side panel + batch suggestions)
- New endpoint: POST /ai/suggest-kr (heuristic + LLM)
- KRSuggestionsPanel component with [Apply] buttons
- Non-blocking, stateless (no WebSocket needed)
- Uses existing /ai/suggest-* pattern

## ADR-3: Guideline Assignment → Option C (scopes + optional guideline_ids)
- Keep scopes for auto-loading (80% case)
- Add guideline_ids for explicit assignment (20% case)
- Final = union(scopes) ∪ explicit, deduplicated
- UI: auto-loaded list + "Customize" expander

## ADR-4: Objective Dependencies → Option B (typed relations)
- relations: [{type, target_id, notes}]
- Types: depends_on, related_to, supersedes, duplicates
- Cycle detection on save
- Matches ideas.relations pattern
- Graph visualization deferred to Phase 3

## Component Diagram
```
ObjectiveForm
  ├─ BasicFields (title, desc, appetite, scope)
  ├─ KREditor (metric OR description mode)
  │   └─ KRSuggestionsPanel (side panel, from /ai/suggest-kr)
  ├─ GuidelineAssignment (auto from scopes + explicit picker)
  ├─ KnowledgeLinker (search/select K-NNN)
  └─ RelationEditor (type + target picker)
```

## Implementation Phases
Phase 1 (Schema+API): KR description + guideline_ids + relations fields — 2-3 days
Phase 2 (LLM+UI): suggest-kr endpoint + suggestions panel + form enhancements — 3-4 days
Phase 3 (Advanced): Graph visualization, bulk operations — future

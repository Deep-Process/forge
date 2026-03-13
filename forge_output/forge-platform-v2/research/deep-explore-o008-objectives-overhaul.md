# Deep-Explore Analysis: O-008 Objectives Module Overhaul
Date: 2026-03-11T22:30:00Z
Skill: deep-explore v1.0
Decision: D-014 (exploration)

---

## Option Maps

### 1. KR Schema: **Option A (Extended Schema)** — RECOMMENDED
- Add optional `description`, `success_criteria`, `assumptions` fields
- Add enrichment fields: `suggested_baseline`, `baseline_confidence`, `baseline_reasoning`
- Backward compatible: existing numeric KRs unchanged

### 2. Frontend UI: **Option A2 (Multi-stage)** — RECOMMENDED
- Light form for creation (metric, target, baseline, optional description)
- Rich detail page for enrichment (suggestions, guidelines, knowledge)
- Aligns with Ideas workflow (DRAFT → EXPLORING → APPROVED)

### 3. LLM Integration: **Option C (Hybrid heuristic + LLM)** — RECOMMENDED
- Immediate heuristic suggestions (knowledge, guidelines via token/scope overlap)
- On-demand LLM enrichment (baselines, success criteria)
- New endpoint: POST /ai/enrich-objective
- Non-blocking, user accepts/rejects

### 4. Guidelines: **Option C (Hybrid scopes + explicit)** — RECOMMENDED
- Keep `scopes` for auto-loading
- Add `guideline_ids` field for explicit assignments
- Final = union(scopes-based) ∪ explicit, deduplicated

### 5. Dependencies: **Defer to Phase 2** — RECOMMENDED
- Focus Phase 1 on KR enrichment + guidelines/knowledge
- Objective deps rarely needed, can add later

## Key Files to Modify

**Backend**: objectives.py (router + contracts), ai.py (new endpoint)
**Frontend**: types.ts, objective.ts (schema), ObjectiveForm.tsx, objectives/[id]/page.tsx
**Core**: core/objectives.py (contracts)

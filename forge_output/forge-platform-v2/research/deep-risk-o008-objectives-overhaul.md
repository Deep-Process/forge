# Deep-Risk Analysis: O-008 Objectives Module Overhaul
Date: 2026-03-11T22:30:00Z
Skill: deep-risk v1.0
Decision: D-015 (risk register)

---

## Risk Register (8 risks, 5D scoring)

| Risk | P | I | V | D | R | Composite | Tier |
|------|---|---|---|---|---|-----------|------|
| R-1: Backward compat (KR schema) | 4 | 4 | 3 | 3 | 2 | **3.2** | T1 |
| R-2: Schema migration (PostgreSQL) | 2 | 3 | 3 | 4 | 3 | **3.0** | T3 |
| R-3: LLM integration complexity | 4 | 3 | 4 | 2 | 4 | **3.4** | T2 |
| R-4: API contract changes | 3 | 4 | 4 | 4 | 3 | **3.6** | T1 |
| R-5: UI complexity explosion | 4 | 3 | 3 | 2 | 4 | **3.2** | T2 |
| R-6: Circular dependencies | 3 | 4 | 2 | 3 | 4 | **3.2** | T2 |
| R-7: Performance (multi-fetch) | 4 | 2 | 4 | 4 | 4 | **3.6** | T2 |
| R-8: Scope creep | 4 | 3 | 3 | 4 | 3 | **3.4** | T1 |

## Reinforcing Loop
R-8 (scope) → R-5 (UI complexity) → R-3 (LLM integration) → R-8
Break with: MVP scope segmentation + form decomposition

## Mitigation Priority
T1 (planning): R-8 scope segmentation, R-1 dual-mode KR, R-4 API backward compat
T2 (implementation): R-3 skill contracts, R-5 form decomposition, R-6 cycle detection, R-7 lazy loading
T3 (validation): R-2 migration script + rollback

## Verdict: GO with mandatory scope segmentation into phases

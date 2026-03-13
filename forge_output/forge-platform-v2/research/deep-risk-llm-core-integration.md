# Deep-Risk Analysis: LLM Core Integration (O-010 + O-011)
Date: 2026-03-12T10:30:00Z
Skill: deep-risk v1.0
Objective: O-010, O-011

---

## 1. Context

**Scope**: Full LLM integration into ForgePrime — live provider connection, tool-use agent loop, reusable chat, permission system, multi-file skills
**Time Horizon**: 2-3 months (large appetite)
**What's at stake**: Core platform value proposition — ForgePrime as AI-powered orchestrator vs. just a project tracker

## 2. Risk Register

### R-001: Token Cost Explosion
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 4 (Likely) | Agentic loops with tool-use can use 10-50x tokens vs single-shot |
| Impact | 3 (Moderate) | Financial cost, but not system failure |
| Velocity | 3 (Moderate) | Cost accumulates over days/weeks |
| Detectability | 2 (Detectable) | Token tracking built into design |
| Reversibility | 2 (Easy) | Can switch models, add limits |
| **Composite** | **19 (HIGH)** | |

**Mitigation**: Per-session token limits (configurable), model selection (Haiku for simple ops, Sonnet for complex), cost dashboard in UI, warning when approaching limits.

### R-002: LLM Tool Call Hallucination
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 3 (Possible) | Claude's tool-use is reliable but not perfect |
| Impact | 3 (Moderate) | Wrong entity modified, data corruption |
| Velocity | 4 (Fast) | Damage happens immediately on tool execution |
| Detectability | 3 (Requires effort) | Must compare tool args to expected |
| Reversibility | 3 (Moderate) | Entity has history but no automatic undo |
| **Composite** | **19 (HIGH)** | |

**Mitigation**: Strict JSON Schema validation on every tool call, entity scoping (LLM can only modify context entity by default), tool call preview in chat UI, undo mechanism via entity versioning.

### R-003: Permission System Complexity
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 3 (Possible) | Granular permissions are hard to get right |
| Impact | 2 (Minor) | Too restrictive = useless, too permissive = risky |
| Velocity | 2 (Gradual) | Issues surface over time as users try features |
| Detectability | 2 (Detectable) | Permission denials are logged |
| Reversibility | 1 (Trivial) | Can always change permissions |
| **Composite** | **11 (MODERATE)** | |

**Mitigation**: Start with simple model (read-all + write-current-entity), sensible defaults, progressive disclosure (advanced settings hidden).

### R-004: WebSocket Connection Stability
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 2 (Unlikely) | WS already works for entity events |
| Impact | 3 (Moderate) | Lost tokens during streaming = broken UX |
| Velocity | 4 (Fast) | Disconnect = immediate loss |
| Detectability | 1 (Obvious) | User sees stream stop |
| Reversibility | 2 (Easy) | Reconnect + replay from session |
| **Composite** | **13 (MODERATE)** | |

**Mitigation**: Already have reconnection logic in ForgeWebSocket. Add: session-based replay (on reconnect, fetch missed tokens from session), client-side buffering, retry indicator in UI.

### R-005: Scope Creep — "AI Everywhere" Before Core Works
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 4 (Likely) | User wants LLM in all modules simultaneously |
| Impact | 4 (Major) | Spread too thin = nothing works well |
| Velocity | 2 (Gradual) | Happens over weeks of development |
| Detectability | 3 (Requires effort) | Hard to see until it's too late |
| Reversibility | 3 (Moderate) | Refocusing is possible but wastes effort |
| **Composite** | **22 (HIGH)** | |

**Mitigation**: Feature flags enforce sequencing: skills first (O-011), then one more module, then expand. Each module must WORK before enabling the next. Feature flag defaults: skills=true, rest=false.

### R-006: Provider API Changes / Outages
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 2 (Unlikely) | Anthropic/OpenAI APIs are stable |
| Impact | 4 (Major) | LLM features completely down |
| Velocity | 4 (Fast) | Instant when API goes down |
| Detectability | 1 (Obvious) | Health check fails |
| Reversibility | 2 (Easy) | Switch to backup provider |
| **Composite** | **15 (MODERATE)** | |

**Mitigation**: Multi-provider support with fallback (if Claude down → try OpenAI → try Ollama). Health check endpoint. Graceful degradation (platform works without LLM, just no AI features).

### R-007: Chat Session Data Loss
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 2 (Unlikely) | Redis is reliable |
| Impact | 2 (Minor) | User loses conversation, not entity data |
| Velocity | 4 (Fast) | Redis restart = data loss |
| Detectability | 1 (Obvious) | Empty conversation on reload |
| Reversibility | 4 (Difficult) | Can't recover lost session |
| **Composite** | **13 (MODERATE)** | |

**Mitigation**: Sessions are ephemeral by design (24h TTL). Entity changes are persisted in PostgreSQL (durable). Option to archive important sessions to PostgreSQL. Tool call results are persisted as entity updates.

### R-008: Security — Prompt Injection via User Input
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Probability | 3 (Possible) | User or file content may contain injection attempts |
| Impact | 3 (Moderate) | LLM executes unintended tool calls |
| Velocity | 4 (Fast) | Immediate execution |
| Detectability | 4 (Hidden) | Hard to distinguish from legitimate requests |
| Reversibility | 3 (Moderate) | Depends on what was executed |
| **Composite** | **22 (HIGH)** | |

**Mitigation**: Tool calls validated against JSON Schema (structural protection), permission system limits blast radius, uploaded file content sanitized (stripped of system prompt patterns), all tool calls logged for audit.

## 3. Top 5 Risks (by composite score)

| # | Risk | Composite | Category |
|---|------|-----------|----------|
| 1 | R-005: Scope Creep | 22 (HIGH) | Organizational |
| 2 | R-008: Prompt Injection | 22 (HIGH) | Security |
| 3 | R-001: Token Cost Explosion | 19 (HIGH) | Financial |
| 4 | R-002: Tool Call Hallucination | 19 (HIGH) | Technical |
| 5 | R-006: Provider API Changes | 15 (MODERATE) | Dependency |

## 4. Risk Interactions

| Risk A | Risk B | Interaction |
|--------|--------|-------------|
| R-001 (Cost) | R-005 (Scope Creep) | AMPLIFIES: more modules with LLM = more cost |
| R-002 (Hallucination) | R-008 (Injection) | AMPLIFIES: injection can trigger hallucinated tool calls |
| R-005 (Scope Creep) | R-002 (Hallucination) | AMPLIFIES: less testing time = more bugs |
| R-001 (Cost) | R-002 (Hallucination) | AMPLIFIES: retries on hallucination = more tokens |

**Cascade Risk**: R-005 (scope creep) → R-002 (less testing → more hallucinations) → R-001 (more retries → more cost) → R-008 (more surface area → more injection vectors).

**Root Cause**: Trying to do too much too fast. Mitigation: strict phasing via feature flags.

## 5. Cobra Effect Check

| Mitigation | Potential Backfire |
|------------|-------------------|
| Per-session token limits | Users frustrated by cutoffs mid-conversation → break work into many short sessions (more overhead) |
| Feature flags (skills only first) | Pressure to enable all modules before Skills is stable → same scope creep via workaround |
| Permission system (conservative defaults) | LLM appears useless → users think feature is broken → abandon |
| Strict tool call validation | Legitimate edge cases rejected → LLM can't help with non-standard operations |

**Adjusted Mitigations:**
- Token limits: soft limit with warning, hard limit with option to continue (user click)
- Feature flags: communicate timeline ("Skills → Tasks → Objectives" progression)
- Permissions: smart defaults based on context (in Skill editor → full skill write access)
- Tool validation: validation errors shown in chat, LLM can self-correct

## 6. Uncertainties (NOT risks)

1. **Optimal model selection per operation** — don't know if Haiku is sufficient for skill editing or if Sonnet is needed
2. **User adoption patterns** — will users prefer chat-based editing or manual editing with occasional AI help?
3. **Cost profile** — what's the average token cost per skill creation session?
4. **Multi-file skill complexity** — will users create skills with many files or mostly just SKILL.md?
5. **Optimal system prompt length** — how much context does LLM need to be useful vs. how much slows it down?

## 7. Not Assessed

- Multi-tenant security (SaaS mode, Phase 5)
- Rate limiting per user (single-user for now)
- GDPR/data privacy implications of sending content to LLM APIs
- Legal implications of LLM-generated code in skills

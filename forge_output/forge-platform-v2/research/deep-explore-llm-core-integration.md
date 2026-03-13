# Deep-Explore Analysis: LLM Core Integration (O-010)
Date: 2026-03-12T10:30:00Z
Skill: deep-explore v1.0
Objective: O-010

---

## 1. Knowledge Audit

### Confirmed Facts
- Provider adapters (Anthropic, OpenAI, Ollama) are FULLY IMPLEMENTED in `core/llm/providers/`
- LLMProvider Protocol defines: `complete()`, `stream()`, `capabilities()`
- Contract system exists in `core/llm/contract.py` with 12 registered contracts
- Context Assembly Engine is complete (`core/llm/context.py`) with 9 prioritized sections
- AI Router (`forge-api/app/routers/ai.py`) has 6 endpoints — ALL returning MOCK data
- WebSocket infrastructure works (Redis Pub/Sub, ForgeWebSocket client, ExecutionStream pattern)
- SkillEditor.tsx is 670 lines with 2-column layout (editor + metadata tabs)
- Zustand store factory pattern is established (createEntityStore)
- Tool-use is supported by both Anthropic and OpenAI adapters (ToolDefinition conversion exists)
- `providers.toml` config exists but API keys are empty

### Assumptions (need validation)
- Contract definitions in `core/llm/contracts/knowledge.py`, `planning.py`, `analysis.py`, `review.py` may be stubs (only `task_execution.py` confirmed complete)
- ProviderRegistry.from_project() works with current providers.toml format
- Anthropic API key via environment variable will be sufficient (no UI needed for MVP)
- WebSocket can handle streaming LLM tokens at sufficient rate

### Knowledge Gaps
- How much of the contract implementations are stubs vs. complete?
- What's the actual latency of Claude API calls through the adapter?
- How much memory does conversation history consume in Redis vs PostgreSQL?
- What's the token cost profile for typical chat interactions?

## 2. Option Map

### Decision 1: Chat Delivery Mechanism (streaming responses)

| Dimension | WebSocket | SSE (Server-Sent Events) | Fetch Streaming |
|-----------|-----------|--------------------------|-----------------|
| **Pattern match** | ExecutionStream already works this way | New pattern, not in codebase | Not in codebase |
| **Bidirectional** | Yes (user can cancel mid-stream) | No (server→client only) | No |
| **Infrastructure** | Already exists (ws.py + ws.ts) | Need new endpoint | Need new endpoint |
| **Reconnection** | Built into ForgeWebSocket | Browser handles | Manual |
| **Complexity** | Low (extend existing) | Medium (new server setup) | Medium |
| **Multi-user** | Natural (broadcast) | Separate connections | Separate connections |
| **Tool call display** | Natural (interleave events) | Possible | Awkward |
| **Key unknown** | Token-level granularity on WS? | — | — |

**Recommendation: WebSocket** — already in codebase, bidirectional (cancel), tool call interleaving natural.

### Decision 2: LLM Chat API Architecture

| Dimension | Global Chat Endpoint | Per-Module Endpoints | Hybrid |
|-----------|---------------------|---------------------|--------|
| **Architecture** | `POST /api/v1/llm/chat` handles all | `/api/v1/skills/{id}/chat`, `/api/v1/tasks/{id}/chat`, etc. | Global endpoint + context routing |
| **Tool scoping** | Server resolves tools by context | Each endpoint defines own tools | Global endpoint, tool set from context |
| **Reusability** | Maximum — one endpoint serves all | Duplicated per module | Maximum + context-specific behavior |
| **Permission model** | Centralized | Distributed | Centralized |
| **Complexity** | Low | High (N endpoints) | Medium |
| **Flexibility** | Needs context param | Implicit from URL | Context param + implicit |
| **Key unknown** | Can one endpoint handle all variations? | — | — |

**Recommendation: Hybrid** — `POST /api/v1/llm/chat` as the single entry point, with `context: {type, id, slug}` that determines available tools and permissions. Server-side routing resolves the right tool set and focus context.

### Decision 3: Tool Execution Model

| Dimension | Agentic Loop | Single-Shot + Follow-Up | Structured Output |
|-----------|-------------|------------------------|-------------------|
| **Pattern** | LLM calls tools → server executes → feeds back → LLM continues | LLM suggests actions → server executes → returns result | LLM returns JSON → server parses and executes |
| **User experience** | Autonomous: LLM "does things" while user watches | Step-by-step: user sees each action before next | Silent: result appears, no visible process |
| **Tool visibility** | Real-time tool calls visible in chat | Real-time, pauses between steps | No tool visibility |
| **Complexity** | High (loop management, timeout, error recovery) | Medium (simpler loop, explicit pauses) | Low (single call) |
| **Token cost** | Highest (multiple round-trips) | Medium | Lowest |
| **Safety** | Needs strong permission checks at each tool call | Natural checkpoints | Safest (no side effects until parsed) |
| **Key unknown** | How many iterations typical? | — | Sufficient for complex tasks? |

**Recommendation: Agentic Loop** — matches user expectation ("LLM modifies my skill while I watch"). With permission system as safety guard. Tool calls visible in chat UI.

### Decision 4: Permission Enforcement Point

| Dimension | Per-Request | Per-Session | Hybrid |
|-----------|------------|-------------|--------|
| **Pattern** | Check permissions before EVERY tool call | Set permissions at session start, trust within session | Check at session start + spot-check dangerous operations |
| **Security** | Highest | Medium (session hijack risk minimal) | High |
| **Performance** | DB/cache hit per tool call | One check on connect | Rare checks |
| **Flexibility** | Permissions can change mid-conversation | Locked for session | Can update for dangerous ops |
| **Complexity** | Simple (middleware) | Simple (one-time) | Medium |
| **Key unknown** | Performance impact of per-request checks? | — | — |

**Recommendation: Hybrid** — load permissions at session start (cached), enforce on every write/delete tool call (cheap if cached). Read operations always allowed.

### Decision 5: Multi-File Skill Storage

| Dimension | JSONB Array in Skill Row | Separate skill_files Table | Virtual FS (S3/disk) |
|-----------|------------------------|---------------------------|---------------------|
| **Pattern** | `files: [{path, content, type}]` in skill JSONB | `skill_files(skill_id, path, content, type)` | Files on disk/S3, metadata in DB |
| **Query** | JSONB path queries | Simple JOINs | File API + metadata query |
| **Size limit** | ~1MB per skill (JSONB limit practical) | Unlimited per file | Unlimited |
| **Versioning** | Complex (version whole JSONB) | Per-file versioning possible | Git-like versioning |
| **Complexity** | Low | Medium | High |
| **Migration** | Add column to existing table | New table + FK | New service |
| **Key unknown** | Will skills exceed JSONB size limits? | — | — |

**Recommendation: JSONB Array** for v1 — skills are small (SKILL.md < 500 lines, scripts/references are short). Migrate to separate table if size becomes issue. Matches existing patterns (evals_json is JSONB).

### Decision 6: Provider Management

| Dimension | Environment Variables Only | DB-Stored with UI | Config File (TOML) |
|-----------|--------------------------|-------------------|-------------------|
| **Pattern** | ANTHROPIC_API_KEY in .env | Encrypted in PostgreSQL, managed via UI | providers.toml (current) |
| **Security** | Secure (not in DB) | Encrypted at rest, never in API responses | File on disk |
| **UX** | Must restart to change | Hot-swap via UI | Must restart |
| **Multi-provider** | Limited (one key per provider) | Full (multiple configs per provider) | Full |
| **Key unknown** | — | Encryption key management? | — |

**Recommendation: Hybrid** — environment variables for API keys (security), DB/config for model selection and defaults (flexibility). UI shows configured providers (reads from env + config), allows model selection, but API keys are set via environment.

## 3. Consequence Trace

### Option A: WebSocket + Global Chat + Agentic Loop (RECOMMENDED)

**1st Order:**
- Single chat endpoint with context routing
- WebSocket streams tokens and tool calls
- LLM executes tools autonomously within permission bounds

**2nd Order:**
- Every module can add LLM chat by providing context + tool definitions
- Debug Console (O-007) naturally captures all interactions
- Session management creates audit trail

**3rd Order:**
- Platform becomes an "AI operating system" — LLM is a first-class process
- New features can be LLM-native (defined as contracts + tools, not code)
- Competitive advantage: no other project orchestrator has this depth of AI integration

### Option B: Per-Module Endpoints + Single-Shot

**1st Order:**
- Each module implements its own AI endpoint
- Simpler per endpoint, but N endpoints to maintain

**2nd Order:**
- Inconsistent behavior across modules
- No shared session management
- Harder to add new modules

**3rd Order:**
- Technical debt accumulates
- Refactoring to unified system eventually required

## 4. Challenge

### Strongest argument AGAINST recommended approach:
**"Agentic loop with tool-use is complex, expensive, and fragile. A simpler text-generation approach would deliver value faster."**

**Counter:** The user explicitly wants LLM to "do things" (modify skills, run lint, change metadata). Text-only means manual apply for every change. The agentic loop IS the core value proposition. Complexity is manageable with the existing contract system + permission model.

### Failure conditions:
1. **Token cost explosion** — agentic loops can use 10-50x tokens vs single-shot. Mitigation: session token limits, model selection (Haiku for simple operations).
2. **Tool call errors** — LLM hallucinates tool calls. Mitigation: strict JSON Schema validation, retry with error message.
3. **Permission complexity** — granular permissions are hard to get right. Mitigation: start with coarse (read/write per module), refine later.

## 5. Synthesis

### READY TO PROCEED

The recommended architecture is:
1. **WebSocket** for chat streaming (extend existing infrastructure)
2. **Global chat endpoint** with context routing (`POST /api/v1/llm/chat`)
3. **Agentic loop** with tool-use (LLM autonomy within permission bounds)
4. **Hybrid permissions** (cached at session start, enforced on writes)
5. **JSONB Array** for multi-file skills (v1, migrate if needed)
6. **Env vars for API keys** + DB/config for model preferences

### What Was NOT Explored
- Multi-agent scenarios (multiple LLMs collaborating)
- Embedding-based knowledge search (vector DB)
- LLM fine-tuning for Forge-specific tasks
- Cost optimization strategies beyond model selection
- Offline LLM operation (Ollama without internet)

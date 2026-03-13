# Deep-Explore: Debug Console v2 Options
Date: 2026-03-13
Skill: deep-explore v1.0.0

---

## Knowledge Audit

### Known Facts
- LLM Monitor calls useParams() to get slug but lives in root layout (BottomPanel) - returns {} on non-project pages
- Event Stream reads from activityStore which is populated by wsDispatcher - but WS only connects inside ProjectLayout
- API Inspector uses debugStore which appends entries to array tail - render order is oldest-first
- AI Sidebar has 4 tabs (Chat, Tools, Scopes, History) - no Debug tab exists
- Streaming works via WS chat.token events dispatched by wsDispatcher -> chatStore.handleWsEvent()
- Errors in chat show as [Error: {message}] where message is extracted from caught error
- debugStore.addEntry receives full {method, url, status, duration, requestBody, responseBody, error} - the data IS there
- Backend debug sessions are stored in debug_sessions.json, only created when capture is enabled

### Assumptions
- useParams() is the root cause of LLM Monitor/Event Stream failures (CONFIRMED by code analysis)
- WebSocket transport is stable - issues are about scope, not connectivity (CONFIRMED)
- Backend debug endpoints return proper error details (503 on uninitialized DebugCapture only edge case)
- Claude API responses include content_block_start/content_block_delta events that can be parsed into structured sections

### Unknown Gaps
- Exact CSS causing text selection issues in response body (need runtime inspection)
- Whether react-json-view or similar is already a dependency
- User expectations for Debug tab update frequency vs performance impact
- Whether WS events include enough metadata to reconstruct structured stream view

---

## Area 1: LLM Monitor + Event Stream Not Working (KR-1)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. Prop-based slug - BottomPanel reads slug from URL or global projectStore, passes as prop | Modify BottomPanel, LlmMonitor, EventStream to accept slug prop; add slug to a global store | Low - straightforward refactor | Simple, explicit data flow, components work anywhere | Whether projectStore exists or needs creation |
| B. Global WS manager - singleton WS that connects to last-visited project | New ForgeWebSocket singleton outside ProjectLayout; connect on project visit, keep alive | Medium - WS lifecycle complexity, stale connections | Events persist across navigation | When to disconnect? Memory/connection leaks |
| C. Disable on non-project - show Navigate to a project message when no slug | Conditional render in BottomPanel based on route | None | Zero refactor risk | Reduced functionality |

### Consequence Trace: Option A (Prop-based slug)
- 1st order: LlmMonitor and EventStream receive slug, SWR keys valid, data fetches work
- 2nd order: Components become reusable - could embed in other layouts
- 3rd order: Pattern establishes prop-based data passing for all BottomPanel children - cleaner architecture

### Consequence Trace: Option B (Global WS manager)
- 1st order: Events flow regardless of page - richer activity feed
- 2nd order: Multiple project connections? Need project-switching logic. Memory grows.
- 3rd order: Potential WebSocket connection pool management - over-engineering for current needs

### Recommendation: Option A (prop-based slug) with Option C as graceful fallback
Pass slug from BottomPanel (extracted from URL pathname). When slug is null, show disabled state with navigation hint.

---

## Area 2: API Inspector Ordering (KR-2)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. Reverse render - use .toReversed() in component | 1-line change in ApiInspector | None | Newest first, no store change | None |
| B. Prepend in store - unshift instead of push | Modify debugStore.addEntry | Breaks circular buffer logic | Store reflects visual order | Performance with 200 entries |
| C. Sort toggle - user can switch between newest/oldest first | UI toggle + sort logic | Minor complexity | Flexibility | User preference persistence |

### Recommendation: Option A with auto-scroll to top on new entry
Simplest change, zero side effects. Add scrollToTop ref behavior when new entry arrives.

---

## Area 3: AI Sidebar Debug Tab (KR-3)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. New Debug tab - 5th tab with structured stream view | New tab in AISidebar, stream parser component, subscribe to WS chat events | Medium - parser complexity, UI real estate | Full transparency, separate from chat UX | WS event format for content blocks |
| B. Inline toggle in Chat - expand/collapse structured view within Chat tab | Toggle button in Chat header, overlay panel | Low - less code | Less UI disruption | Can it coexist with chat messages? |
| C. Separate debug panel - floating window/modal with stream view | New modal component, global shortcut | Medium - window management | Does not affect sidebar layout | Discoverability |

### Consequence Trace: Option A (New Debug tab)
- 1st order: User sees thinking/tool_calls/response in real-time structured sections
- 2nd order: Debugging LLM behavior becomes intuitive - reduces support burden
- 3rd order: Foundation for future observability features (token budgets, latency graphs)

### Recommendation: Option A - dedicated Debug tab
Structured view with sections: Thinking (collapsible), Tool Calls (with params/results), Response (final text). Subscribe to existing WS chat.* events. Show model, tokens, latency metadata.

---

## Area 4: Error Messages (KR-4)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. Enrich at API layer - api.ts interceptor captures full error context | Modify api.ts error handling, create ApiError class with status/endpoint/body | Low - localized change | All consumers get rich errors for free | Whether all errors pass through api.ts |
| B. ErrorDisplay component - shared component that renders rich errors | New component, adopt across all debug views | Low | Consistent error UX | Adoption effort |
| C. Backend structured errors - API returns error details in consistent format | Backend changes across all endpoints | High - large scope | Root cause fix | Backend effort |

### Recommendation: Option A + B - enrich at source AND create shared display component
Api.ts already has the interceptor pattern (setDebugInterceptor). Extend error objects with {status, url, method, responseExcerpt}. Create ErrorDetail component for consistent rendering.

---

## Area 5: Text Selection + Request Params (KR-5)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. CSS fix + detail panel - user-select: text on code blocks, add request params section | CSS changes, new RequestDetail section in ApiInspector expanded view | None | Quick fix + new feature | Exact CSS causing issue |
| B. Copy button - add copy-to-clipboard for response/request bodies | New button per body section | None | Works even if CSS is tricky | None |
| C. Full request inspector - collapsible sections for headers, params, body, response | Significant UI rework of ApiInspector expanded view | Medium - complexity | Professional inspector UX | Design effort |

### Recommendation: Option C (full request inspector) since appetite is large
Collapsible sections: Headers, Query Params, Request Body, Response Body, Timing. All with selectable text + copy button. JSON bodies get syntax highlighting.

---

## Area 6: Visual Redesign (KR-6)

| Option | Requirements | Risks | Benefits | Key Unknown |
|--------|-------------|-------|----------|-------------|
| A. Design tokens - shared color/spacing/font constants for debug components | New debug theme file, apply across all components | Low | Consistency | Design decisions |
| B. JSON syntax highlighting - react-json-view or custom highlighter | New dependency or component | Low | Readability | Bundle size impact |
| C. Full redesign - new visual language for entire debug console | Significant UI effort | Medium - scope creep | Professional look | Design reference |

### Recommendation: Option A + B + incremental C
Start with design tokens and JSON highlighting. Apply new visual language incrementally as each KR area is implemented.

---

## What Was NOT Explored
- Performance impact of structured stream parsing on slow devices
- Accessibility audit of debug components (screen readers, keyboard nav)
- Mobile/tablet responsiveness of debug panel
- Integration with external monitoring tools (Sentry, Datadog)
- Persistence of debug data across page refreshes (IndexedDB)
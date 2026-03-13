# Deep-Risk: Debug Console v2 Risk Assessment
Date: 2026-03-13
Skill: deep-risk v1.0.0

---

Scope: Debug Console v2 refactoring and new features (O-023)
Horizon: Large appetite (months)

## Risk Register

| # | Risk | P | I | V | D | R | Composite | Category |
|---|------|---|---|---|---|---|-----------|----------|
| R1 | Infinite re-render from Debug tab WS subscriptions | 4 | 3 | 5 | 3 | 1 | 21 | Technical |
| R2 | WS event format lacks content_block metadata for structured view | 3 | 4 | 2 | 4 | 2 | 20 | Dependency |
| R3 | Scope creep from large appetite + 6 KRs | 4 | 3 | 2 | 2 | 2 | 18 | Organizational |
| R4 | Slug prop refactor breaks existing BottomPanel functionality | 2 | 3 | 4 | 2 | 1 | 13 | Technical |
| R5 | JSON highlighter bundle size impact | 2 | 2 | 1 | 3 | 1 | 9 | Technical |
| R6 | Memory growth from increased event buffers | 2 | 2 | 1 | 4 | 1 | 10 | Technical |
| R7 | Design inconsistency during incremental rollout | 3 | 2 | 1 | 2 | 1 | 9 | Temporal |

## Top 5 Risks (by composite score)

### 1. Infinite re-render from Debug tab WS subscriptions - Composite: 21
Description: New Debug tab subscribes to WS chat.* events to show structured stream. If subscription triggers React state updates per token (dozens per second), component re-renders cascade through the sidebar tree.
Why it ranks high: P=4 (L-018 documents this exact pattern happening before), V=5 (instant - manifests immediately as UI freeze), D=3 (may not appear in dev with small responses).
Mitigation: Use ref+subscription pattern from L-018. Store streaming data in useRef, notify subscribers via Set<() => void>. Only update React state on content_block boundaries (not per token). Throttle UI updates to 100ms intervals.

### 2. WS event format lacks content_block metadata - Composite: 20
Description: The structured Debug tab needs to know whether incoming tokens are thinking, tool_use, or text. Current WS chat.token events may only send raw text deltas without content_block type. If so, the parser cannot distinguish sections.
Why it ranks high: I=4 (blocks KR-3 entirely if true), D=4 (only discoverable by inspecting actual WS traffic at runtime).
Mitigation: Inspect backend WS emission code. If metadata is missing, extend backend to include content_block_type in chat.token events. This is a backend change but small scope.

### 3. Scope creep from large appetite + 6 KRs - Composite: 18
Description: Six KRs spanning bug fixes, new features, and visual redesign. Large appetite may encourage over-engineering each area. Risk of spending months without shipping anything.
Why it ranks high: P=4 (common with large objectives), I=3 (delayed value delivery).
Mitigation: Phase deliveries: Phase 1 (bug fixes - KR-1, KR-2, KR-4), Phase 2 (new features - KR-3, KR-5), Phase 3 (visual polish - KR-6). Ship each phase independently.

### 4. Slug prop refactor breaks existing BottomPanel - Composite: 13
Description: Changing how BottomPanel children receive slug (from useParams to props) could introduce regressions if not all children are updated simultaneously.
Why it ranks high: V=4 (breaks immediately if missed).
Mitigation: Update all three children (ApiInspector, LlmMonitor, EventStream) in one task. ApiInspector does not use slug so only needs null-guard. Test on both project and non-project pages.

### 5. Memory growth from increased event buffers - Composite: 10
Description: Increasing EventStream buffer from 50 to 200, plus new Debug tab maintaining its own event history, increases client memory footprint.
Why it ranks high: D=4 (memory leaks are hard to detect without profiling).
Mitigation: Keep circular buffer pattern. Cap Debug tab buffer at 100 events. Monitor with Chrome DevTools memory tab during testing.

## Risk Interactions

| Risk A | Risk B | Interaction | Cascade? |
|--------|--------|-------------|----------|
| R1 (re-render) | R6 (memory) | More re-renders = more garbage collection pressure | Amplify |
| R3 (scope creep) | R7 (design inconsistency) | Longer rollout = more time with inconsistent design | Cascade |
| R2 (WS format) | R1 (re-render) | If WS needs extension, more events = more re-render risk | Amplify |

## Mitigations + Cobra Effect Check

| Mitigation | Fixes | Could Cause/Amplify | Cobra? |
|------------|-------|---------------------|--------|
| ref+subscription for Debug tab | R1 (re-render) | More complex code, harder to debug | No - proven pattern (L-018) |
| Phased delivery | R3 (scope creep) | Phase boundaries add coordination overhead | No - phases are natural (fix/feature/polish) |
| Extend WS events with metadata | R2 (WS format) | More data over WS, slightly higher bandwidth | No - metadata is tiny (<20 bytes per event) |
| Circular buffers everywhere | R6 (memory) | Oldest events lost silently | No - debug data is ephemeral by nature |
| Design tokens early | R7 (inconsistency) | Premature design decisions may need revision | Minor - tokens are easy to update |

## Uncertainties (distinct from risks)
- How users actually use the debug console (no telemetry) - assumptions about workflow may be wrong
- Whether structured stream view adds real value vs raw token view - user said structured, but may change preference
- Performance characteristics of JSON syntax highlighting with large payloads (10KB+ response bodies)

## Not Assessed
- Security risks (debug panel exposing sensitive data - auth tokens in headers, etc.)
- Accessibility compliance risks
- Backend stability under increased WS event volume
- Cross-browser compatibility beyond Chrome
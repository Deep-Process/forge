---
name: graph-api
id: SKILL-GRAPH-API
version: "1.0"
description: "Entity DAG visualization with interactive node operations — edit, AI sidebar binding, filtering, and layout."
scopes: [frontend, backend, graph]
---

# Graph API — Entity DAG

## Identity

| Field | Value |
|-------|-------|
| ID | SKILL-GRAPH-API |
| Version | 1.0 |
| Description | Full-stack entity graph: backend aggregation API, elkjs layout, React Flow rendering, node click operations (Edit → detail page, AI Assistant → sidebar binding), filtering toolbar. |

## Architecture

```
Board Page (/projects/{slug}/board)
  ├─ Kanban view (tasks only, drag-and-drop status changes)
  └─ DAG view (all 9 entity types, read-only graph)
       │
       ▼
┌─ EntityDAG.tsx ──────────────────────────────────────────────┐
│  SWR fetch ──→ GET /projects/{slug}/graph                    │
│                  ?exclude_status=DONE                         │
│                                                               │
│  GraphFilterToolbar                                           │
│    ├─ 9 entity type toggles (with counts)                    │
│    ├─ 4 edge type toggles (depends_on, advances_kr,          │
│    │                        origin, derived_from)             │
│    ├─ Status exclude dropdown (DONE, ACHIEVED, CLOSED)       │
│    └─ Reset button                                            │
│                                                               │
│  React Flow                                                   │
│    ├─ Nodes: EntityNode (memoized, per-type colors)          │
│    ├─ Edges: EntityEdge (memoized, per-type styles)          │
│    ├─ Layout: elkjs via Web Worker (useGraphLayout)           │
│    ├─ Controls: zoom/pan + MiniMap (type-colored)            │
│    ├─ nodesDraggable=false, nodesConnectable=false           │
│    └─ onNodeClick → NodeContextMenu                          │
│         ├─ Edit → router.push to detail page                 │
│         └─ AI Assistant → sidebarStore.setTargetEntity()     │
│                                                               │
│  State: graphStore (Zustand, UI-only — no entity data)       │
│    selectedTypes, statusFilter, edgeTypeFilter, selectedNode │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Backend: graph.py ──────────────────────────────────────────┐
│  GET /api/v1/projects/{slug}/graph                           │
│    ?types=objective,idea,task (optional filter)              │
│    ?exclude_status=DONE,ACHIEVED (optional, comma-separated) │
│                                                               │
│  Loads 9 entity files in parallel (asyncio.gather)           │
│  Builds nodes: {id: "type:ID", type, data: {display fields}}│
│  Derives 4 edge types from entity relationships              │
│  Returns: {nodes[], edges[], meta{counts, generated_at}}     │
└───────────────────────────────────────────────────────────────┘
```

## File Reference

### Frontend

| File | Lines | Role |
|------|-------|------|
| `forge-web/components/graph/EntityDAG.tsx` | 247 | Main wrapper — SWR fetch, filtering, React Flow render, click handler, context menu |
| `forge-web/components/graph/EntityNode.tsx` | 169 | Single memoized node component with `ENTITY_CONFIG` color/field map for 9 types |
| `forge-web/components/graph/EntityEdge.tsx` | 91 | Memoized edge with `EDGE_STYLES` — 4 types, bezier path, label renderer |
| `forge-web/components/graph/NodeContextMenu.tsx` | 117 | Click menu — Edit (navigate) + AI Assistant (sidebar bind) |
| `forge-web/components/graph/GraphFilterToolbar.tsx` | 158 | Entity type toggles, edge type toggles, status exclude dropdown, reset |
| `forge-web/hooks/useGraphLayout.ts` | 69 | Calls `computeElkLayout()`, handles request cancellation, grid fallback |
| `forge-web/lib/elkLayout.ts` | 86 | Singleton ELK with Web Worker, layered algorithm DOWN, node 220x70 |
| `forge-web/stores/graphStore.ts` | 69 | Zustand UI state — selectedTypes, statusFilter, edgeTypeFilter, selectedNodeId |
| `forge-web/app/projects/[slug]/board/page.tsx` | 300 | Board page — Kanban/DAG toggle, DAG renders `EntityDAG` in flex container |
| `forge-web/public/elk-worker.min.js` | — | elkjs Web Worker bundle (D-035 mitigation) |

### Backend

| File | Lines | Role |
|------|-------|------|
| `forge-api/app/routers/graph.py` | 197 | Graph API endpoint — loads entities, builds nodes, derives edges |

## Entity Types (9)

All registered as React Flow `nodeTypes` and backend `ENTITY_SOURCES`:

| Type | Color | Badge | Display Fields | Source File |
|------|-------|-------|---------------|-------------|
| objective | `#3B82F6` (blue) | O | title, status, appetite, scopes | objectives.json |
| idea | `#8B5CF6` (violet) | I | title, status, category, priority | ideas.json |
| task | `#10B981` (emerald) | T | name, status, type, scopes | tracker.json |
| decision | `#F59E0B` (amber) | D | issue, status, type, scope | decisions.json |
| research | `#EC4899` (pink) | R | title, status, category | research.json |
| knowledge | `#6366F1` (indigo) | K | title, status, category, scope | knowledge.json |
| guideline | `#14B8A6` (teal) | G | title, status, scope, weight | guidelines.json |
| lesson | `#F97316` (orange) | L | title, severity, category | lessons.json |
| ac_template | `#64748B` (slate) | AC | title, status, category | ac_templates.json |

## Edge Types (4 derived)

Derived server-side in `_derive_edges()`, deduplicated via `seen` set:

| Type | Style | Derived From | Direction |
|------|-------|-------------|-----------|
| `depends_on` | solid gray `#94A3B8` | `task.depends_on[]` + `idea.relations[type=depends_on]` | Task→Task, Idea→Idea |
| `advances_kr` | solid blue `#3B82F6` | `idea.advances_key_results[]` (parses `"O-001/KR-1"` → `O-001`) | Idea→Objective |
| `origin` | dashed green `#10B981` `6 3` | `task.origin` (prefix `I-` or `O-`) | Task→Idea, Task→Objective |
| `derived_from` | dotted orange `#F97316` `3 3` | `guideline.derived_from` (prefix `O-`) | Guideline→Objective |

All edges validate that both source and target node IDs exist in `node_ids` set before adding.

## Node Click Flow

```
User clicks node in React Flow
  ↓
EntityDAG.handleNodeClick (line 147)
  ├─ graphStore.setSelectedNode(node.id)
  ├─ Parse "entityType:entityId" from node.id
  ├─ Extract label from node.data
  └─ setContextMenu({x, y, entityType, entityId, label})
      ↓
NodeContextMenu renders at click coordinates
  ├─ Header: "entityType:entityId" (monospace)
  ├─ [Edit] button:
  │    ├─ sessionStorage.setItem("forge-from-dag", slug)
  │    ├─ router.push(/projects/{slug}/{route}/{entityId})
  │    └─ TYPE_TO_ROUTE maps all 9 types to URL segments
  └─ [AI Assistant] button:
       ├─ sidebarStore.setTargetEntity({type, id, label})
       └─ sidebarStore.setActiveTab("chat")

Close triggers:
  - Click outside menu (mousedown listener)
  - Escape key (keydown listener)
  - Click on pane (EntityDAG.handlePaneClick)
```

## Layout Engine

```
Raw nodes + edges (from SWR)
  ↓
useGraphLayout hook
  ├─ requestId ref prevents stale layout application
  ├─ computeElkLayout() → runs in Web Worker
  │    ├─ Algorithm: layered, direction DOWN
  │    ├─ Node size: 220x70
  │    ├─ Spacing: nodeNode=50, betweenLayers=80, edgeNode=30
  │    └─ Edge routing: ORTHOGONAL
  └─ Fallback: grid layout (cols = sqrt(N), spacing 260x100)
      ↓
PositionedNode[] with {x, y} coordinates
  ↓
React Flow rfNodes (id, type, position, data)
```

## Filtering Pipeline

```
SWR response (all nodes + edges)
  ↓
filteredNodes = nodes.filter(n → selectedTypes.includes(n.type))
  ↓
filteredNodeIds = Set(filteredNodes.map(n.id))
  ↓
filteredEdges = edges.filter(e →
    filteredNodeIds.has(e.source) &&
    filteredNodeIds.has(e.target) &&
    edgeTypeFilter.includes(e.type)
)
  ↓
useGraphLayout(filteredNodes, filteredEdges)
  ↓
React Flow renders positioned nodes + filtered edges
```

Server-side filtering: `?exclude_status=DONE` removes entities before node building.
Client-side filtering: entity type toggles and edge type toggles applied post-fetch.

## SWR & Revalidation

- **Dedup interval**: 3000ms (`GRAPH_REVALIDATION_MS`, per D-034)
- **Revalidate on focus**: disabled
- **SWR key**: `/projects/${slug}/graph${qs}` — changes when `statusFilter` changes
- **Entity type filter**: client-side only (not in SWR key) — avoids refetch on toggle

## Board Page Integration

```
BoardPage → [Kanban | DAG] toggle (useState)

Kanban view:
  - Tasks only (useEntityData<Task>)
  - Drag-and-drop between status columns (TODO, IN_PROGRESS, DONE, FAILED)
  - Drop calls updateTaskAction(slug, taskId, {status})
  - Scope/type/status filters in header
  - KanbanCard links to /projects/{slug}/tasks/{id}

DAG view:
  - All 9 entity types (Graph API)
  - Own filter toolbar (GraphFilterToolbar)
  - EntityDAG in flex-1 min-h-0 container
  - Read-only (no drag, no connect)
```

## Decisions

| ID | Decision | Notes |
|----|----------|-------|
| D-030 | elkjs + server-side Graph API | Layout computed client-side, data aggregated server-side |
| D-031 | SWR as single source of truth | Node/edge data from API, not stored in Zustand |
| D-032 | elkjs in Web Worker | Prevents UI freeze on 100+ node graphs |
| D-033 | 4 edge types | depends_on, advances_kr, origin, derived_from |
| D-034 | SWR revalidation debounce 2-5s | `GRAPH_REVALIDATION_MS = 3000` |
| D-035 | elkjs freeze risk → Web Worker + fallback grid | Grid fallback on worker failure |

## Constraints

- **Read-only graph**: `nodesDraggable=false`, `nodesConnectable=false` — no visual editing on DAG
- **No inline editing**: All editing happens on entity detail pages (via Edit button)
- **No status changes on DAG**: Status changes only via Kanban drag-and-drop or detail page forms
- **No edge creation on DAG**: Edges are derived server-side from entity relationships
- **Node ID format**: Always `"{entityType}:{entityId}"` — split on first `:` to parse

## Extension Points

When extending the graph system, follow these patterns:

### Adding a New Entity Type

1. Backend `graph.py`: Add to `ENTITY_SOURCES` and `DISPLAY_FIELDS`
2. Frontend `EntityNode.tsx`: Add to `ENTITY_CONFIG` (color, bg, label, fields)
3. Frontend `EntityDAG.tsx`: Add to `nodeTypes` object
4. Frontend `graphStore.ts`: Add to `ALL_ENTITY_TYPES` array
5. Frontend `NodeContextMenu.tsx`: Add to `TYPE_TO_ROUTE` mapping

### Adding a New Edge Type

1. Backend `graph.py` → `_derive_edges()`: Add derivation logic with `_add()` helper
2. Frontend `EntityEdge.tsx`: Add to `EDGE_STYLES` (color, strokeDasharray, label)
3. Frontend `EntityDAG.tsx`: Add to `edgeTypes` object
4. Frontend `graphStore.ts`: Add to default `edgeTypeFilter` array

### Adding a Node Action to Context Menu

1. `NodeContextMenu.tsx`: Add button after AI Assistant
2. Wire up the action (e.g., delete, clone, link)
3. Follow existing pattern: `useCallback` → action → `onClose()`

## DO NOT Modify

- Node ID format `"{type}:{id}"` — used throughout pipeline (splitting, edge derivation, filtering)
- `ENTITY_CONFIG` color assignments — referenced by MiniMap, FilterToolbar, entity chips in sidebar
- `_derive_edges()` dedup via `seen` set — prevents duplicate edges
- elkjs Web Worker pattern — singleton instance, fallback grid on failure
- SWR key structure — must include `statusFilter` to trigger refetch on filter change

## Success Criteria

- [x] Backend aggregates 9 entity types into node+edge graph
- [x] 4 edge types derived from entity relationships with validation
- [x] Parallel entity loading via asyncio.gather
- [x] elkjs layout in Web Worker with grid fallback
- [x] React Flow renders all entity types with distinct colors
- [x] GraphFilterToolbar: entity toggles, edge toggles, status exclude, reset
- [x] Click node → context menu (Edit + AI Assistant)
- [x] Edit navigates to detail page with "Back to DAG" support
- [x] AI Assistant binds sidebar to clicked entity
- [x] SWR revalidation with 3s debounce
- [x] MiniMap with per-type node colors
- [x] Board page: Kanban ↔ DAG toggle
- [x] Kanban: drag-and-drop status changes

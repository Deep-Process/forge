"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import type { Task, TaskStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_W = 180;
const NODE_H = 56;
const H_GAP = 60; // horizontal gap between layers
const V_GAP = 32; // vertical gap between nodes in a layer
const PAD_X = 40; // canvas left padding
const PAD_Y = 40; // canvas top padding
const ARROW_SIZE = 6;

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: "#9ca3af",
  IN_PROGRESS: "#3b82f6",
  DONE: "#22c55e",
  FAILED: "#ef4444",
  SKIPPED: "#d1d5db",
  CLAIMING: "#93c5fd",
};

const STATUS_TEXT_COLORS: Record<TaskStatus, string> = {
  TODO: "#ffffff",
  IN_PROGRESS: "#ffffff",
  DONE: "#ffffff",
  FAILED: "#ffffff",
  SKIPPED: "#374151",
  CLAIMING: "#1e3a5f",
};

// ---------------------------------------------------------------------------
// Layout algorithm — layered DAG (longest-path layer assignment)
// ---------------------------------------------------------------------------

interface NodePos {
  id: string;
  x: number;
  y: number;
  layer: number;
}

/**
 * Compute a layered layout for the task DAG.
 *
 * 1. Build an adjacency list from depends_on edges.
 * 2. Assign each node to a layer = longest path from any root to that node.
 * 3. Position nodes left-to-right by layer, top-to-bottom within layer.
 */
function computeLayout(tasks: Task[]): { nodes: Map<string, NodePos>; width: number; height: number; cycleNodes: Set<string> } {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t.id, t);

  // Build adjacency: parent -> children  (if A depends_on B, edge B -> A)
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const t of tasks) {
    if (!children.has(t.id)) children.set(t.id, []);
    if (!parents.has(t.id)) parents.set(t.id, []);
    for (const dep of t.depends_on) {
      if (!taskMap.has(dep)) continue; // skip unknown refs
      if (!children.has(dep)) children.set(dep, []);
      children.get(dep)!.push(t.id);
      parents.get(t.id)!.push(dep);
    }
  }

  // Layer assignment via longest-path from roots (BFS / topological)
  const layerOf = new Map<string, number>();

  // Kahn's algorithm for topological order
  const inDegree = new Map<string, number>();
  for (const t of tasks) {
    inDegree.set(t.id, (parents.get(t.id) ?? []).filter((p) => taskMap.has(p)).length);
  }
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) {
      queue.push(id);
      layerOf.set(id, 0);
    }
  });

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const curLayer = layerOf.get(cur)!;
    for (const child of children.get(cur) ?? []) {
      const newLayer = curLayer + 1;
      if (!layerOf.has(child) || layerOf.get(child)! < newLayer) {
        layerOf.set(child, newLayer);
      }
      inDegree.set(child, inDegree.get(child)! - 1);
      if (inDegree.get(child) === 0) {
        queue.push(child);
      }
    }
  }

  // Handle cycles or disconnected nodes: assign to max_layer+1 with cycle flag
  const assignedMax = Math.max(0, ...Array.from(layerOf.values()));
  const cycleNodes = new Set<string>();
  for (const t of tasks) {
    if (!layerOf.has(t.id)) {
      layerOf.set(t.id, assignedMax + 1);
      cycleNodes.add(t.id);
    }
  }

  // Group by layer
  const layers = new Map<number, string[]>();
  layerOf.forEach((layer, id) => {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(id);
  });

  // Sort IDs within each layer for stable rendering
  layers.forEach((ids) => ids.sort());

  const layerKeys = Array.from(layers.keys());
  const maxLayer = layerKeys.length > 0 ? Math.max(...layerKeys) : 0;

  // Position nodes
  const nodes = new Map<string, NodePos>();
  let maxY = 0;

  for (let l = 0; l <= maxLayer; l++) {
    const ids = layers.get(l) ?? [];
    const x = PAD_X + l * (NODE_W + H_GAP);
    for (let i = 0; i < ids.length; i++) {
      const y = PAD_Y + i * (NODE_H + V_GAP);
      nodes.set(ids[i], { id: ids[i], x, y, layer: l });
      if (y + NODE_H > maxY) maxY = y + NODE_H;
    }
  }

  const width = PAD_X * 2 + (maxLayer + 1) * NODE_W + maxLayer * H_GAP;
  const height = maxY + PAD_Y;

  return { nodes, width, height, cycleNodes };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BoardPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const { slices, fetchEntities } = useEntityStore();
  const [tooltip, setTooltip] = useState<{ task: Task; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchEntities(slug, "tasks");
  }, [slug, fetchEntities]);

  const tasks = slices.tasks.items as Task[];

  const { nodes, width, height, cycleNodes } = useMemo(() => computeLayout(tasks), [tasks]);

  // Build edge list: for each task that has depends_on, draw dep -> task
  const edges = useMemo(() => {
    const result: { from: string; to: string }[] = [];
    for (const t of tasks) {
      for (const dep of t.depends_on) {
        if (nodes.has(dep) && nodes.has(t.id)) {
          result.push({ from: dep, to: t.id });
        }
      }
    }
    return result;
  }, [tasks, nodes]);

  const handleNodeClick = useCallback(
    (task: Task) => {
      router.push(`/projects/${slug}/tasks?highlight=${task.id}`);
    },
    [router, slug],
  );

  const handleNodeHover = useCallback(
    (e: React.MouseEvent, task: Task | null) => {
      if (!task) {
        setTooltip(null);
        return;
      }
      // Position tooltip relative to the SVG container
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      setTooltip({
        task,
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 8,
      });
    },
    [],
  );

  // Summary counts
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<TaskStatus, number>> = {};
    for (const t of tasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Task Board &mdash; DAG View</h2>
        <div className="flex gap-3 text-xs text-gray-500">
          {(Object.entries(statusCounts) as [TaskStatus, number][]).map(([status, count]) => (
            <span key={status} className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      {slices.tasks.loading && <p className="text-sm text-gray-400">Loading tasks...</p>}
      {slices.tasks.error && <p className="text-sm text-red-600 mb-2">{slices.tasks.error}</p>}

      {tasks.length === 0 && !slices.tasks.loading && (
        <p className="text-sm text-gray-400">No tasks to display.</p>
      )}

      {tasks.length > 0 && (
        <div className="overflow-auto border rounded-lg bg-gray-50 relative">
          <svg
            ref={svgRef}
            width={Math.max(width, 600)}
            height={Math.max(height, 200)}
            className="select-none"
          >
            {/* Arrowhead marker */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth={ARROW_SIZE}
                markerHeight={ARROW_SIZE}
                refX={ARROW_SIZE}
                refY={ARROW_SIZE / 2}
                orient="auto"
              >
                <polygon
                  points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
                  fill="#94a3b8"
                />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map(({ from, to }) => {
              const a = nodes.get(from)!;
              const b = nodes.get(to)!;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              // Cubic bezier for nice curves
              const cx1 = x1 + (x2 - x1) * 0.4;
              const cx2 = x2 - (x2 - x1) * 0.4;
              return (
                <path
                  key={`${from}-${to}`}
                  d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Nodes */}
            {tasks.map((task) => {
              const pos = nodes.get(task.id);
              if (!pos) return null;
              const fill = STATUS_COLORS[task.status] ?? "#9ca3af";
              const textColor = STATUS_TEXT_COLORS[task.status] ?? "#ffffff";

              return (
                <g
                  key={task.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleNodeClick(task)}
                  onMouseEnter={(e) => handleNodeHover(e, task)}
                  onMouseMove={(e) => handleNodeHover(e, task)}
                  onMouseLeave={(e) => handleNodeHover(e, null)}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    ry={8}
                    fill={fill}
                    stroke={cycleNodes.has(task.id) ? "#f97316" : "#e5e7eb"}
                    strokeWidth={cycleNodes.has(task.id) ? 3 : 1}
                    strokeDasharray={cycleNodes.has(task.id) ? "6 3" : undefined}
                    className="transition-opacity hover:opacity-90"
                  />
                  {/* Task ID */}
                  <text
                    x={NODE_W / 2}
                    y={20}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="ui-monospace, monospace"
                  >
                    {task.id}
                  </text>
                  {/* Task name (truncated) */}
                  <text
                    x={NODE_W / 2}
                    y={40}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={10}
                    fontFamily="system-ui, sans-serif"
                  >
                    {task.name.length > 22 ? task.name.slice(0, 20) + "\u2026" : task.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-xs"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="font-semibold text-gray-800 mb-1">
                {tooltip.task.id} &mdash; {tooltip.task.name}
              </div>
              <div className="text-gray-500 mb-1">
                Status:{" "}
                <span
                  className="font-medium"
                  style={{ color: STATUS_COLORS[tooltip.task.status] }}
                >
                  {tooltip.task.status}
                </span>
              </div>
              {tooltip.task.description && (
                <div className="text-gray-600 leading-snug">
                  {tooltip.task.description.length > 120
                    ? tooltip.task.description.slice(0, 118) + "\u2026"
                    : tooltip.task.description}
                </div>
              )}
              {tooltip.task.depends_on.length > 0 && (
                <div className="text-gray-400 mt-1">
                  Depends on: {tooltip.task.depends_on.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

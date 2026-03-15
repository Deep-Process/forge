"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import useSWR from "swr";

import { EntityNode, ENTITY_CONFIG } from "./EntityNode";
import { EntityEdge } from "./EntityEdge";
import { GraphFilterToolbar } from "./GraphFilterToolbar";
import { NodeContextMenu } from "./NodeContextMenu";
import { useGraphLayout } from "@/hooks/useGraphLayout";
import { useGraphStore, type EntityType } from "@/stores/graphStore";
import type { GraphNode, GraphEdge } from "@/lib/elkLayout";

/** Custom node types for React Flow */
const nodeTypes = {
  objective: EntityNode,
  idea: EntityNode,
  task: EntityNode,
  decision: EntityNode,
  research: EntityNode,
  knowledge: EntityNode,
  guideline: EntityNode,
  lesson: EntityNode,
  ac_template: EntityNode,
};

/** Custom edge types */
const edgeTypes = {
  depends_on: EntityEdge,
  advances_kr: EntityEdge,
  origin: EntityEdge,
  derived_from: EntityEdge,
};

interface GraphApiResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    entity_counts: Record<string, number>;
    edge_counts: Record<string, number>;
    total_nodes: number;
    total_edges: number;
  };
}

interface EntityDAGProps {
  slug: string;
  onNodeClick?: (nodeId: string, entityType: string, entityId: string) => void;
}

/** Graph-specific SWR revalidation debounce (2-5s per D-034) */
const GRAPH_REVALIDATION_MS = 3000;

interface ContextMenuState {
  x: number;
  y: number;
  entityType: string;
  entityId: string;
  label: string;
}

export function EntityDAG({ slug, onNodeClick }: EntityDAGProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const selectedTypes = useGraphStore((s) => s.selectedTypes);
  const statusFilter = useGraphStore((s) => s.statusFilter);
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter);
  const setSelectedNode = useGraphStore((s) => s.setSelectedNode);

  // Build query params for SWR key
  const swrKey = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("exclude_status", statusFilter);
    const qs = params.toString();
    return `/projects/${slug}/graph${qs ? `?${qs}` : ""}`;
  }, [slug, statusFilter]);

  // Fetch graph data via SWR (global fetcher handles auth)
  const { data, isLoading } = useSWR<GraphApiResponse>(swrKey, {
    dedupingInterval: GRAPH_REVALIDATION_MS,
    revalidateOnFocus: false,
  });

  // Filter nodes by selected types
  const filteredNodes = useMemo<GraphNode[]>(() => {
    if (!data?.nodes) return [];
    return data.nodes.filter((n) =>
      selectedTypes.includes(n.type as EntityType),
    );
  }, [data?.nodes, selectedTypes]);

  // Filter edges: both endpoints must be visible, and edge type must be enabled
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo<GraphEdge[]>(() => {
    if (!data?.edges) return [];
    return data.edges.filter(
      (e) =>
        filteredNodeIds.has(e.source) &&
        filteredNodeIds.has(e.target) &&
        edgeTypeFilter.includes(e.type),
    );
  }, [data?.edges, filteredNodeIds, edgeTypeFilter]);

  // Compute layout via elkjs (in Web Worker)
  const { nodes: positionedNodes, isLayouting } = useGraphLayout(
    filteredNodes,
    filteredEdges,
  );

  // Convert to React Flow format
  const rfNodes = useMemo<Node[]>(
    () =>
      positionedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
    [positionedNodes],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      filteredEdges.map((e, i) => ({
        id: e.id || `e-${i}`,
        source: e.source,
        target: e.target,
        type: e.type,
        data: { type: e.type, label: e.label },
      })),
    [filteredEdges],
  );

  // Handle node click — open context menu
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
      // node.id is "entityType:entityId"
      const [entityType, ...rest] = node.id.split(":");
      const entityId = rest.join(":");
      const label = (node.data as Record<string, unknown>)?.label as string ?? entityId;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        entityType,
        entityId,
        label,
      });
      if (onNodeClick) {
        onNodeClick(node.id, entityType, entityId);
      }
    },
    [onNodeClick, setSelectedNode],
  );

  // Close context menu on pane click
  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // MiniMap node color
  const miniMapNodeColor = useCallback((node: Node) => {
    const config = ENTITY_CONFIG[node.type ?? ""];
    return config?.color ?? "#94A3B8";
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Loading graph data...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <GraphFilterToolbar
        entityCounts={data?.meta?.entity_counts}
      />
      <div style={{ flex: 1, position: "relative" }}>
        {isLayouting && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              padding: "4px 12px",
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            Computing layout...
          </div>
        )}
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor="rgba(0,0,0,0.1)"
            style={{ width: 150, height: 100 }}
          />
        </ReactFlow>
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            entityType={contextMenu.entityType}
            entityId={contextMenu.entityId}
            label={contextMenu.label}
            slug={slug}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

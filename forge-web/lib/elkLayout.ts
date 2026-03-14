/**
 * elkjs layout computation via Web Worker.
 *
 * Uses the elkjs worker in public/elk-worker.min.js to run layout
 * off the main thread (D-035 mitigation).
 */
import ELK, { type ElkNode } from "elkjs";

// Singleton ELK instance with Web Worker
let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) {
    elkInstance = new ELK({
      workerUrl: "/elk-worker.min.js",
    });
  }
  return elkInstance;
}

export interface GraphNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface PositionedNode extends GraphNode {
  position: { x: number; y: number };
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

/**
 * Compute layout positions for nodes using elkjs layered algorithm.
 * Runs in a Web Worker for graphs with 100+ nodes.
 */
export async function computeElkLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<PositionedNode[]> {
  const elk = getElk();

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "50",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((e, i) => ({
      id: e.id || `e-${i}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(graph);

  // Map positions back to nodes
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layout.children ?? []) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return nodes.map((n) => ({
    ...n,
    position: positionMap.get(n.id) ?? { x: 0, y: 0 },
  }));
}

/**
 * Hook for computing elkjs layout from raw graph data.
 * Returns positioned nodes ready for React Flow.
 */
import { useEffect, useRef, useState } from "react";
import {
  computeElkLayout,
  type GraphNode,
  type GraphEdge,
  type PositionedNode,
} from "@/lib/elkLayout";

interface UseGraphLayoutResult {
  nodes: PositionedNode[];
  isLayouting: boolean;
}

/**
 * Takes raw nodes and edges from the Graph API and returns
 * positioned nodes via elkjs layout computation.
 *
 * Recomputes layout only when the node/edge structure changes
 * (not on every render).
 */
export function useGraphLayout(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
): UseGraphLayoutResult {
  const [nodes, setNodes] = useState<PositionedNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (rawNodes.length === 0) {
      setNodes([]);
      return;
    }

    const currentRequest = ++requestId.current;
    setIsLayouting(true);

    computeElkLayout(rawNodes, rawEdges)
      .then((positioned) => {
        // Only apply if this is still the latest request
        if (currentRequest === requestId.current) {
          setNodes(positioned);
          setIsLayouting(false);
        }
      })
      .catch(() => {
        if (currentRequest === requestId.current) {
          // Fallback: place nodes in a grid
          const cols = Math.ceil(Math.sqrt(rawNodes.length));
          setNodes(
            rawNodes.map((n, i) => ({
              ...n,
              position: {
                x: (i % cols) * 260,
                y: Math.floor(i / cols) * 100,
              },
            })),
          );
          setIsLayouting(false);
        }
      });
  }, [rawNodes, rawEdges]);

  return { nodes, isLayouting };
}

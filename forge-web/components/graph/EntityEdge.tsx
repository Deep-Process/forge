"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

/** Edge type visual configuration */
const EDGE_STYLES: Record<
  string,
  { color: string; strokeDasharray?: string; label: string }
> = {
  depends_on: { color: "#94A3B8", label: "depends on" },
  advances_kr: { color: "#3B82F6", label: "advances KR" },
  origin: { color: "#10B981", strokeDasharray: "6 3", label: "origin" },
  derived_from: {
    color: "#F97316",
    strokeDasharray: "3 3",
    label: "derived from",
  },
};

const DEFAULT_STYLE = { color: "#CBD5E1", label: "" };

function EntityEdgeInner(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const edgeType = (data?.type as string) ?? "";
  const style = EDGE_STYLES[edgeType] ?? DEFAULT_STYLE;
  const edgeLabel = (data?.label as string) || style.label;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: style.strokeDasharray,
        }}
      />
      {edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              fontSize: 9,
              color: style.color,
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: "1px 4px",
              borderRadius: 3,
              whiteSpace: "nowrap",
            }}
            className="nodrag nopan"
            title={edgeLabel}
          >
            {edgeLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const EntityEdge = memo(EntityEdgeInner);
export { EDGE_STYLES };

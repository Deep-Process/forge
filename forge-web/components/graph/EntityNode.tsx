"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/** Entity type visual configuration */
const ENTITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string; fields: string[] }
> = {
  objective: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    label: "O",
    fields: ["status", "appetite"],
  },
  idea: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    label: "I",
    fields: ["status", "category"],
  },
  task: {
    color: "#10B981",
    bg: "#ECFDF5",
    label: "T",
    fields: ["status", "type"],
  },
  decision: {
    color: "#F59E0B",
    bg: "#FFFBEB",
    label: "D",
    fields: ["status", "type"],
  },
  research: {
    color: "#EC4899",
    bg: "#FDF2F8",
    label: "R",
    fields: ["status", "category"],
  },
  knowledge: {
    color: "#6366F1",
    bg: "#EEF2FF",
    label: "K",
    fields: ["status", "category"],
  },
  guideline: {
    color: "#14B8A6",
    bg: "#F0FDFA",
    label: "G",
    fields: ["status", "weight"],
  },
  lesson: {
    color: "#F97316",
    bg: "#FFF7ED",
    label: "L",
    fields: ["severity", "category"],
  },
  ac_template: {
    color: "#64748B",
    bg: "#F8FAFC",
    label: "AC",
    fields: ["status", "category"],
  },
};

const DEFAULT_CONFIG = {
  color: "#94A3B8",
  bg: "#F1F5F9",
  label: "?",
  fields: [] as string[],
};

interface EntityNodeData {
  id: string;
  label: string;
  [key: string]: unknown;
}

type EntityNodeProps = NodeProps & {
  data: EntityNodeData;
  type: string;
};

function EntityNodeInner({ data, type }: EntityNodeProps) {
  const config = ENTITY_CONFIG[type ?? ""] ?? DEFAULT_CONFIG;
  const entityId = data.id as string;
  const label = (data.label as string) || entityId;

  // Truncate label for display
  const displayLabel = label.length > 30 ? label.slice(0, 28) + "..." : label;

  // Build status/meta line from config fields
  const metaParts: string[] = [];
  for (const field of config.fields) {
    const val = data[field];
    if (val != null && val !== "") {
      metaParts.push(String(val));
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{
          width: 200,
          padding: "8px 10px",
          borderRadius: 6,
          border: `2px solid ${config.color}`,
          backgroundColor: config.bg,
          fontSize: 12,
          fontFamily: "system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 4,
              backgroundColor: config.color,
              color: "#fff",
              fontWeight: 700,
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            {config.label}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: "#1E293B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={label}
          >
            {displayLabel}
          </span>
        </div>
        {metaParts.length > 0 && (
          <div
            style={{
              marginTop: 4,
              color: "#64748B",
              fontSize: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entityId} &middot; {metaParts.join(" &middot; ")}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

export const EntityNode = memo(EntityNodeInner);
export { ENTITY_CONFIG };

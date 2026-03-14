"use client";

import { useGraphStore, ALL_ENTITY_TYPES, type EntityType } from "@/stores/graphStore";
import { ENTITY_CONFIG } from "./EntityNode";
import { EDGE_STYLES } from "./EntityEdge";

interface GraphFilterToolbarProps {
  entityCounts?: Record<string, number>;
}

export function GraphFilterToolbar({ entityCounts }: GraphFilterToolbarProps) {
  const selectedTypes = useGraphStore((s) => s.selectedTypes);
  const toggleType = useGraphStore((s) => s.toggleType);
  const statusFilter = useGraphStore((s) => s.statusFilter);
  const setStatusFilter = useGraphStore((s) => s.setStatusFilter);
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter);
  const setEdgeTypeFilter = useGraphStore((s) => s.setEdgeTypeFilter);
  const resetFilters = useGraphStore((s) => s.resetFilters);

  const toggleEdgeType = (type: string) => {
    if (edgeTypeFilter.includes(type)) {
      setEdgeTypeFilter(edgeTypeFilter.filter((t) => t !== type));
    } else {
      setEdgeTypeFilter([...edgeTypeFilter, type]);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 12px",
        borderBottom: "1px solid #E2E8F0",
        backgroundColor: "#FAFAFA",
        alignItems: "center",
        fontSize: 11,
      }}
    >
      {/* Entity type filters */}
      {ALL_ENTITY_TYPES.map((type) => {
        const config = ENTITY_CONFIG[type];
        const active = selectedTypes.includes(type);
        const count = entityCounts?.[type] ?? 0;
        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              border: `1px solid ${active ? config?.color ?? "#94A3B8" : "#E2E8F0"}`,
              backgroundColor: active ? config?.bg ?? "#F1F5F9" : "#fff",
              color: active ? config?.color ?? "#64748B" : "#94A3B8",
              cursor: "pointer",
              fontWeight: active ? 600 : 400,
              fontSize: 11,
              opacity: active ? 1 : 0.6,
            }}
            title={`${type} (${count})`}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: config?.color ?? "#94A3B8",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              {config?.label ?? "?"}
            </span>
            {type}
            {count > 0 && (
              <span style={{ color: "#94A3B8", fontSize: 10 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}

      {/* Separator */}
      <span style={{ color: "#CBD5E1", margin: "0 2px" }}>|</span>

      {/* Edge type filters */}
      {Object.entries(EDGE_STYLES).map(([type, style]) => {
        const active = edgeTypeFilter.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggleEdgeType(type)}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${active ? style.color : "#E2E8F0"}`,
              backgroundColor: active ? "#fff" : "#F8FAFC",
              color: active ? style.color : "#94A3B8",
              cursor: "pointer",
              fontSize: 10,
              opacity: active ? 1 : 0.5,
            }}
            title={style.label}
          >
            {style.label}
          </button>
        );
      })}

      {/* Separator */}
      <span style={{ color: "#CBD5E1", margin: "0 2px" }}>|</span>

      {/* Status filter */}
      <select
        value={statusFilter ?? ""}
        onChange={(e) => setStatusFilter(e.target.value || null)}
        style={{
          padding: "2px 6px",
          borderRadius: 4,
          border: "1px solid #E2E8F0",
          fontSize: 11,
          color: "#475569",
          backgroundColor: "#fff",
        }}
      >
        <option value="">All statuses</option>
        <option value="DONE">Exclude DONE</option>
        <option value="ACHIEVED">Exclude ACHIEVED</option>
        <option value="CLOSED">Exclude CLOSED</option>
      </select>

      {/* Reset */}
      <button
        onClick={resetFilters}
        style={{
          padding: "2px 8px",
          borderRadius: 4,
          border: "1px solid #E2E8F0",
          backgroundColor: "#fff",
          color: "#64748B",
          cursor: "pointer",
          fontSize: 11,
        }}
      >
        Reset
      </button>
    </div>
  );
}

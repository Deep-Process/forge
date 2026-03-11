"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import type { ImpactItem } from "@/lib/types";

interface ImpactAlertProps {
  /** Title of the knowledge item that changed. */
  knowledgeTitle: string;
  /** Summary text from the impact assessment. */
  summary: string;
  /** List of affected entities with impact levels. */
  impactItems: ImpactItem[];
  /** Total count of affected entities. */
  totalAffected: number;
  /** Called when the user dismisses the alert. */
  onDismiss?: () => void;
}

/** Map impact level to severity color classes. */
function severityClasses(items: ImpactItem[]): string {
  const hasHigh = items.some((it) => it.impact_level === "high");
  if (hasHigh) return "border-red-400 bg-red-50";
  const hasMedium = items.some((it) => it.impact_level === "medium");
  if (hasMedium) return "border-yellow-400 bg-yellow-50";
  return "border-blue-400 bg-blue-50";
}

function impactBadgeVariant(level: string): "danger" | "warning" | "default" {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "default";
}

export function ImpactAlert({
  knowledgeTitle,
  summary,
  impactItems,
  totalAffected,
  onDismiss,
}: ImpactAlertProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalAffected === 0) return null;

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${severityClasses(impactItems)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold">Impact Alert</span>
            <Badge variant={impactItems.some((i) => i.impact_level === "high") ? "danger" : "warning"}>
              {totalAffected} affected
            </Badge>
          </div>
          <p className="text-sm text-gray-700">
            Changes to <span className="font-medium">{knowledgeTitle}</span> may
            affect linked entities.
          </p>
          <p className="text-xs text-gray-500 mt-1">{summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white/60 transition-colors"
          >
            {expanded ? "Hide" : "Details"}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {impactItems.map((item) => (
            <div
              key={`${item.entity_type}-${item.entity_id}`}
              className="flex items-center gap-2 text-xs"
            >
              <Badge variant={impactBadgeVariant(item.impact_level)}>
                {item.impact_level}
              </Badge>
              <span className="text-gray-500">{item.entity_type}</span>
              <span className="font-medium text-gray-700">
                {item.entity_id}
              </span>
              {item.name && (
                <span className="text-gray-500 truncate">{item.name}</span>
              )}
              <span className="text-gray-400 ml-auto truncate max-w-[200px]">
                {item.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

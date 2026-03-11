"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";

interface SuggestionChipProps {
  /** Display name / title of the suggested entity. */
  title: string;
  /** Relevance score from 0 to 1. */
  relevanceScore: number;
  /** Explanation of why this was suggested. */
  reason: string;
  /** Called when the user accepts the suggestion. */
  onAccept: () => Promise<void> | void;
  /** Called when the user dismisses the suggestion. */
  onDismiss: () => void;
  /** Optional extra label (e.g. guideline weight, AC category). */
  label?: string;
}

/** Color-code confidence: green >0.7, yellow >0.4, gray otherwise. */
function confidenceColor(score: number): string {
  if (score > 0.7) return "border-l-green-500 bg-green-50/50";
  if (score > 0.4) return "border-l-yellow-500 bg-yellow-50/50";
  return "border-l-gray-400 bg-gray-50/50";
}

function confidenceBadgeVariant(score: number): "success" | "warning" | "default" {
  if (score > 0.7) return "success";
  if (score > 0.4) return "warning";
  return "default";
}

export function SuggestionChip({
  title,
  relevanceScore,
  reason,
  onAccept,
  onDismiss,
  label,
}: SuggestionChipProps) {
  const [accepting, setAccepting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept();
    } finally {
      setAccepting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const pct = Math.round(relevanceScore * 100);

  return (
    <div
      className={`rounded-md border border-l-4 p-3 transition-colors ${confidenceColor(relevanceScore)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium truncate">{title}</h4>
            <Badge variant={confidenceBadgeVariant(relevanceScore)}>{pct}%</Badge>
            {label && <Badge>{label}</Badge>}
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{reason}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="rounded px-2 py-1 text-xs font-medium text-white bg-forge-600 hover:bg-forge-700 disabled:opacity-50 transition-colors"
          >
            {accepting ? "..." : "Accept"}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { ai } from "@/lib/api";
import type { KRSuggestion } from "@/lib/types";

interface KRSuggestionsPanelProps {
  slug: string;
  objectiveId: string;
  onApply: (suggestion: KRSuggestion) => void;
}

export function KRSuggestionsPanel({ slug, objectiveId, onApply }: KRSuggestionsPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const { data, error, isLoading, mutate } = useSWR(
    collapsed ? null : `suggest-kr-${slug}-${objectiveId}`,
    () => ai.suggestKR(slug, objectiveId),
    { revalidateOnFocus: false }
  );

  const handleApply = useCallback((suggestion: KRSuggestion, idx: number) => {
    onApply(suggestion);
    setAppliedIds((prev) => new Set(prev).add(idx));
  }, [onApply]);

  const handleRefresh = useCallback(() => {
    setAppliedIds(new Set());
    mutate();
  }, [mutate]);

  return (
    <div className="mb-4 border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 text-sm font-medium text-gray-700 hover:bg-purple-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-purple-500">AI</span>
          KR Suggestions
        </span>
        <span className="text-xs text-gray-400">{collapsed ? "Expand" : "Collapse"}</span>
      </button>

      {!collapsed && (
        <div className="p-3 bg-white">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-forge-500 rounded-full animate-spin" />
              Loading suggestions...
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 py-2">
              Failed to load suggestions.{" "}
              <button onClick={handleRefresh} className="text-forge-600 hover:text-forge-800 font-medium">
                Retry
              </button>
            </div>
          )}

          {data && data.suggestions && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {data.suggestions.length} suggestions ({data.mode} mode)
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="text-xs text-forge-600 hover:text-forge-800"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-2">
                {data.suggestions.map((s, idx) => (
                  <SuggestionCard
                    key={idx}
                    suggestion={s}
                    applied={appliedIds.has(idx)}
                    onApply={() => handleApply(s, idx)}
                  />
                ))}
              </div>
            </>
          )}

          {data && (!data.suggestions || data.suggestions.length === 0) && (
            <p className="text-xs text-gray-400 py-2">No suggestions available for this objective.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  applied,
  onApply,
}: {
  suggestion: KRSuggestion;
  applied: boolean;
  onApply: () => void;
}) {
  const [showRationale, setShowRationale] = useState(false);

  return (
    <div className={`p-2.5 rounded border text-xs ${applied ? "bg-green-50 border-green-200" : "bg-gray-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-700 flex-1">{suggestion.description}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-400 tabular-nums">
            {Math.round(suggestion.relevance_score * 100)}%
          </span>
          {applied ? (
            <span className="text-[10px] text-green-600 font-medium">Applied</span>
          ) : (
            <button
              type="button"
              onClick={onApply}
              className="px-2 py-0.5 bg-forge-600 text-white rounded text-[10px] font-medium hover:bg-forge-700"
            >
              Apply
            </button>
          )}
        </div>
      </div>
      {suggestion.metric_hint && (
        <p className="text-[10px] text-gray-400 mt-1">Hint: {suggestion.metric_hint}</p>
      )}
      {suggestion.metric && (
        <p className="text-[10px] text-blue-500 mt-1">Metric: {suggestion.metric}</p>
      )}
      <button
        type="button"
        onClick={() => setShowRationale(!showRationale)}
        className="text-[10px] text-gray-400 hover:text-gray-600 mt-1"
      >
        {showRationale ? "Hide rationale" : "Why?"}
      </button>
      {showRationale && (
        <p className="text-[10px] text-gray-500 mt-1 italic">{suggestion.rationale}</p>
      )}
    </div>
  );
}

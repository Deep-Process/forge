"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAISuggestions } from "@/hooks/useAISuggestions";
import { SuggestionChip } from "./SuggestionChip";
import { knowledge as knowledgeApi } from "@/lib/api";
import type {
  AISuggestionEntityType,
  AISuggestionType,
  KnowledgeSuggestion,
  GuidelineSuggestion,
  ACSuggestion,
} from "@/lib/types";

interface SuggestionPanelProps {
  /** The type of entity to get suggestions for. */
  entityType: AISuggestionEntityType;
  /** The entity ID. */
  entityId: string;
  /** Which suggestion types to show. Defaults to ["knowledge", "guidelines"]. */
  suggestionTypes?: AISuggestionType[];
  /** Whether the panel starts open. */
  defaultOpen?: boolean;
}

/** Type guard helpers. */
function isKnowledgeSuggestion(s: unknown): s is KnowledgeSuggestion {
  return typeof s === "object" && s !== null && "knowledge_id" in s;
}

function isGuidelineSuggestion(s: unknown): s is GuidelineSuggestion {
  return typeof s === "object" && s !== null && "guideline_id" in s;
}

function isACSuggestion(s: unknown): s is ACSuggestion {
  return typeof s === "object" && s !== null && "template_id" in s;
}

/** Tab labels for suggestion types. */
const TAB_LABELS: Record<AISuggestionType, string> = {
  knowledge: "Knowledge",
  guidelines: "Guidelines",
  ac: "Acceptance Criteria",
};

export function SuggestionPanel({
  entityType,
  entityId,
  suggestionTypes = ["knowledge", "guidelines"],
  defaultOpen = false,
}: SuggestionPanelProps) {
  const { slug } = useParams() as { slug: string };
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<AISuggestionType>(suggestionTypes[0]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { suggestions, loading, error, refetch } = useAISuggestions(
    slug,
    entityType,
    entityId,
    activeTab,
  );

  const handleAccept = async (suggestion: KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion) => {
    try {
      // For knowledge suggestions, create a link
      if (isKnowledgeSuggestion(suggestion)) {
        await knowledgeApi.link(slug, suggestion.knowledge_id, {
          entity_type: entityType,
          entity_id: entityId,
          relation: "context",
        });
      }
      // For guideline/AC suggestions, mark as accepted (dismiss from UI)
      const key = getSuggestionKey(suggestion);
      setDismissed((prev) => new Set(prev).add(key));
    } catch {
      // Keep suggestion visible on failure so user can retry
    }
  };

  const handleDismiss = (suggestion: KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion) => {
    const key = getSuggestionKey(suggestion);
    setDismissed((prev) => new Set(prev).add(key));
  };

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.has(getSuggestionKey(s)),
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[70vh] flex flex-col">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="self-end mb-1 flex items-center gap-2 rounded-full bg-forge-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-forge-700 transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
        AI Suggestions
        {open ? " (close)" : ""}
      </button>

      {/* Panel body */}
      {open && (
        <div className="rounded-lg border bg-white shadow-xl flex flex-col overflow-hidden">
          {/* Tabs */}
          {suggestionTypes.length > 1 && (
            <div className="flex border-b">
              {suggestionTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveTab(type);
                    setDismissed(new Set());
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === type
                      ? "border-b-2 border-forge-600 text-forge-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {TAB_LABELS[type]}
                </button>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[50vh]">
            {/* Get suggestions button */}
            {suggestions.length === 0 && !loading && !error && (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 mb-3">
                  Get AI-powered {TAB_LABELS[activeTab].toLowerCase()} suggestions
                  for this {entityType}.
                </p>
                <button
                  onClick={refetch}
                  className="rounded-md bg-forge-600 px-4 py-2 text-sm font-medium text-white hover:bg-forge-700 transition-colors"
                >
                  Get Suggestions
                </button>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-forge-600 border-t-transparent" />
                <span className="ml-2 text-sm text-gray-500">Analyzing...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-xs text-red-600">{error}</p>
                <button
                  onClick={refetch}
                  className="mt-2 text-xs font-medium text-red-700 hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Suggestion chips */}
            {visibleSuggestions.map((suggestion) => {
              const key = getSuggestionKey(suggestion);
              return (
                <SuggestionChip
                  key={key}
                  title={getSuggestionTitle(suggestion)}
                  relevanceScore={suggestion.relevance_score}
                  reason={suggestion.reason}
                  label={getSuggestionLabel(suggestion)}
                  onAccept={() => handleAccept(suggestion)}
                  onDismiss={() => handleDismiss(suggestion)}
                />
              );
            })}

            {/* All dismissed */}
            {!loading &&
              suggestions.length > 0 &&
              visibleSuggestions.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400 mb-2">
                    All suggestions reviewed.
                  </p>
                  <button
                    onClick={() => {
                      setDismissed(new Set());
                      refetch();
                    }}
                    className="text-xs font-medium text-forge-600 hover:text-forge-700"
                  >
                    Refresh
                  </button>
                </div>
              )}
          </div>

          {/* Footer with refresh */}
          {suggestions.length > 0 && visibleSuggestions.length > 0 && (
            <div className="border-t px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={refetch}
                disabled={loading}
                className="text-[10px] font-medium text-forge-600 hover:text-forge-700 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSuggestionKey(
  s: KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion,
): string {
  if (isKnowledgeSuggestion(s)) return `knowledge-${s.knowledge_id}`;
  if (isGuidelineSuggestion(s)) return `guideline-${s.guideline_id}`;
  if (isACSuggestion(s)) return `ac-${s.template_id}`;
  return `unknown-${JSON.stringify(s)}`;
}

function getSuggestionTitle(
  s: KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion,
): string {
  return s.title;
}

function getSuggestionLabel(
  s: KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion,
): string | undefined {
  if (isGuidelineSuggestion(s)) return s.weight;
  if (isACSuggestion(s)) return s.category;
  return undefined;
}

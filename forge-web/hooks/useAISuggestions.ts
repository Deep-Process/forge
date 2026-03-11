"use client";

import { useState, useCallback } from "react";
import { ai } from "@/lib/api";
import type {
  AISuggestionEntityType,
  AISuggestionType,
  KnowledgeSuggestion,
  GuidelineSuggestion,
  ACSuggestion,
} from "@/lib/types";

export type AnySuggestion = KnowledgeSuggestion | GuidelineSuggestion | ACSuggestion;

interface UseAISuggestionsResult {
  suggestions: AnySuggestion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching AI suggestions.
 *
 * @param slug - Project slug.
 * @param entityType - The type of entity to get suggestions for.
 * @param entityId - The entity ID.
 * @param suggestionType - Which kind of suggestions: "knowledge", "guidelines", or "ac".
 */
export function useAISuggestions(
  slug: string,
  entityType: AISuggestionEntityType,
  entityId: string,
  suggestionType: AISuggestionType,
): UseAISuggestionsResult {
  const [suggestions, setSuggestions] = useState<AnySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!slug || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      let result: AnySuggestion[] = [];
      switch (suggestionType) {
        case "knowledge": {
          const res = await ai.suggestKnowledge(slug, entityType, entityId);
          result = res.suggestions;
          break;
        }
        case "guidelines": {
          const res = await ai.suggestGuidelines(slug, entityType, entityId);
          result = res.suggestions;
          break;
        }
        case "ac": {
          const res = await ai.suggestAC(slug, entityId);
          result = res.suggestions;
          break;
        }
      }
      setSuggestions(result);
    } catch (e) {
      setError((e as Error).message);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [slug, entityType, entityId, suggestionType]);

  return { suggestions, loading, error, refetch };
}

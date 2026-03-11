"use client";

import useSWR from "swr";
import { projectPath } from "@/lib/api";

/**
 * SWR hook for fetching a single entity by ID.
 *
 * Returns { data, isLoading, error, mutate } with automatic
 * caching and WS-triggered revalidation.
 */
export function useEntityDetail<T>(
  slug: string | null,
  entity: string,
  id: string | null,
) {
  const key = slug && id ? projectPath(slug, entity, id) : null;

  const { data, error, isLoading, mutate } = useSWR<T>(key);

  return {
    data: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    mutate,
    cacheKey: key,
  };
}

/**
 * Build the SWR cache key for a single entity (for external revalidation).
 */
export function entityDetailKey(slug: string, entity: string, id: string): string {
  return projectPath(slug, entity, id);
}

"use client";

import useSWR from "swr";
import { projectPath } from "@/lib/api";

/**
 * SWR hook for fetching entity lists.
 *
 * Returns { items, count, isLoading, error, mutate } with automatic
 * caching, deduplication, and WS-triggered revalidation.
 */
export function useEntityData<T>(
  slug: string | null,
  entity: string,
  params?: Record<string, string>,
) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const key = slug ? `${projectPath(slug, entity)}${qs}` : null;

  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>>(
    key,
  );

  // Entity lists return { [entity]: T[], count: number }
  // e.g. { tasks: [...], count: 5 }
  const responseKey = entity === "ac-templates" ? "templates" : entity;
  const items = (data?.[responseKey] as T[] | undefined) ?? [];
  const count = (data?.count as number | undefined) ?? 0;

  return {
    items,
    count,
    isLoading,
    error: error ? (error as Error).message : null,
    mutate,
    /** SWR cache key — use with mutate() from other components */
    cacheKey: key,
  };
}

/**
 * Build the SWR cache key for an entity list (for external revalidation).
 */
export function entityListKey(slug: string, entity: string, params?: Record<string, string>): string {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return `${projectPath(slug, entity)}${qs}`;
}

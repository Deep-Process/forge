"use client";

import { useEffect } from "react";
import type { AIPageConfig } from "./types";
import { useAIPageContextSafe } from "./AIPageProvider";

/**
 * Declare page-level metadata for AI context.
 * Call once per page component.
 *
 * @example
 * ```tsx
 * function TasksPage() {
 *   useAIPage({ id: "tasks", title: "Tasks", description: "Task list for project" });
 *   return <div>...</div>;
 * }
 * ```
 */
export function useAIPage(config: AIPageConfig): void {
  const ctx = useAIPageContextSafe();

  useEffect(() => {
    if (!ctx) return;
    ctx.setPageConfig(config);
    return () => {
      ctx.setPageConfig(null);
    };
    // Re-register when config identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, config.id, config.title, config.description, config.route]);
}

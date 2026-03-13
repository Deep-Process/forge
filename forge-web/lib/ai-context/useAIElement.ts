"use client";

import { useEffect, useRef } from "react";
import type { AIElementDescriptor } from "./types";
import { useAIPageContextSafe } from "./AIPageProvider";

/**
 * Register a component's AI-readable description.
 * Call in any component that should be visible to AI.
 *
 * @example
 * ```tsx
 * function StatusFilter({ value, onChange }) {
 *   useAIElement({
 *     id: "status-filter",
 *     type: "filter",
 *     label: "Status Filter",
 *     value,
 *     actions: [{ label: "Filter", description: "Filter tasks by status" }],
 *   });
 *   return <select>...</select>;
 * }
 * ```
 */
export function useAIElement(descriptor: AIElementDescriptor): void {
  const ctx = useAIPageContextSafe();
  const idRef = useRef(descriptor.id);

  useEffect(() => {
    if (!ctx) return;

    // If ID changed, clean up old registration before registering new one
    if (idRef.current !== descriptor.id) {
      ctx.unregister(idRef.current);
      idRef.current = descriptor.id;
    }

    ctx.register(descriptor);
  });

  // Cleanup on unmount only
  useEffect(() => {
    if (!ctx) return;
    return () => {
      ctx.unregister(idRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);
}

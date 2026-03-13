"use client";

import React, { createContext, useContext, useRef, useCallback } from "react";
import type { AIElementDescriptor, AIPageConfig, AIContextSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AIPageContextValue {
  /** Register or update an element descriptor */
  register: (descriptor: AIElementDescriptor) => void;

  /** Remove an element by ID */
  unregister: (id: string) => void;

  /** Set page-level metadata */
  setPageConfig: (config: AIPageConfig | null) => void;

  /** Get current snapshot (lazy — only computed when called) */
  getSnapshot: () => AIContextSnapshot;
}

const AIPageContext = createContext<AIPageContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AIPageProvider({ children }: { children: React.ReactNode }) {
  // Use refs to avoid re-renders on registration changes.
  // Annotations are metadata, not visual — no need to trigger re-renders.
  const elementsRef = useRef(new Map<string, AIElementDescriptor>());
  const pageConfigRef = useRef<AIPageConfig | null>(null);

  const register = useCallback((descriptor: AIElementDescriptor) => {
    elementsRef.current.set(descriptor.id, descriptor);
  }, []);

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  const setPageConfig = useCallback((config: AIPageConfig | null) => {
    pageConfigRef.current = config;
  }, []);

  const getSnapshot = useCallback((): AIContextSnapshot => {
    return {
      pageConfig: pageConfigRef.current,
      elements: new Map(elementsRef.current),
    };
  }, []);

  // Stable context value — callbacks are memoized via useCallback
  const value = useRef<AIPageContextValue>({
    register,
    unregister,
    setPageConfig,
    getSnapshot,
  }).current;

  return (
    <AIPageContext.Provider value={value}>{children}</AIPageContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function useAIPageContext(): AIPageContextValue {
  const ctx = useContext(AIPageContext);
  if (!ctx) {
    throw new Error("useAIPageContext must be used within AIPageProvider");
  }
  return ctx;
}

/**
 * Safe version that returns null if outside provider.
 * Useful for components that may render outside the provider tree.
 */
export function useAIPageContextSafe(): AIPageContextValue | null {
  return useContext(AIPageContext);
}

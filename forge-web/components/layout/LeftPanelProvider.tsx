"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Context — uses ref + subscription to avoid re-rendering the entire tree
// when content changes. Only LeftPanel (the consumer) re-renders.
// ---------------------------------------------------------------------------

interface LeftPanelContextValue {
  setContent: (node: ReactNode | null) => void;
  subscribe: (callback: () => void) => () => void;
  getContent: () => ReactNode | null;
}

const LeftPanelContext = createContext<LeftPanelContextValue>({
  setContent: () => {},
  subscribe: () => () => {},
  getContent: () => null,
});

export function LeftPanelProvider({ children }: { children: ReactNode }) {
  const contentRef = useRef<ReactNode | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const value = useMemo<LeftPanelContextValue>(() => ({
    setContent: (node: ReactNode | null) => {
      contentRef.current = node;
      listenersRef.current.forEach((fn) => fn());
    },
    subscribe: (callback: () => void) => {
      listenersRef.current.add(callback);
      return () => { listenersRef.current.delete(callback); };
    },
    getContent: () => contentRef.current,
  }), []);

  return (
    <LeftPanelContext.Provider value={value}>
      {children}
    </LeftPanelContext.Provider>
  );
}

/**
 * Hook for pages to declare left panel content.
 * Content is synced on every render and cleared on unmount.
 * Does NOT cause re-renders of the provider tree.
 */
export function useLeftPanel(content: ReactNode) {
  const { setContent } = useContext(LeftPanelContext);

  // Sync content on every render (ref-based, no state update in provider)
  useEffect(() => {
    setContent(content);
  });

  // Clear on unmount
  useEffect(() => {
    return () => setContent(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContent]);
}

/**
 * Hook for LeftPanel to read content. Subscribes to changes
 * so only LeftPanel re-renders when content updates.
 */
export function useLeftPanelContent(): ReactNode | null {
  const { subscribe, getContent } = useContext(LeftPanelContext);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => setTick((n) => n + 1));
    // Force initial read — content may have been set before subscription
    setTick((n) => n + 1);
    return unsub;
  }, [subscribe]);

  return getContent();
}

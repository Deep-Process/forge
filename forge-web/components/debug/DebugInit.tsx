"use client";

import { useEffect } from "react";
import { setDebugInterceptor } from "@/lib/api";
import { useDebugStore } from "@/stores/debugStore";

/**
 * Invisible component that wires up the debug interceptor on mount.
 * Placed in root layout to ensure it runs once on app start.
 */
export function DebugInit() {
  useEffect(() => {
    const addEntry = useDebugStore.getState().addEntry;
    setDebugInterceptor(addEntry);
  }, []);

  return null;
}

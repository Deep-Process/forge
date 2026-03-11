"use client";

import { useState, useEffect, useCallback } from "react";
import { debug as debugApi } from "@/lib/api";

interface DebugToggleProps {
  slug: string;
  onToggle?: (enabled: boolean) => void;
}

export function DebugToggle({ slug, onToggle }: DebugToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    debugApi.status(slug).then((res) => {
      if (!cancelled) setEnabled(res.enabled);
    }).catch(() => {
      // Status endpoint not available yet — keep disabled
    });
    return () => { cancelled = true; };
  }, [slug]);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (enabled) {
        await debugApi.disable(slug);
        setEnabled(false);
        onToggle?.(false);
      } else {
        await debugApi.enable(slug);
        setEnabled(true);
        onToggle?.(true);
      }
    } catch {
      // Silently handle — backend may not be ready
    } finally {
      setLoading(false);
    }
  }, [slug, enabled, onToggle]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
      title={enabled ? "Debug monitor enabled — click to disable" : "Debug monitor disabled — click to enable"}
    >
      {/* Bug / magnifier icon */}
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span>Debug</span>
      {loading && (
        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
      )}
    </button>
  );
}

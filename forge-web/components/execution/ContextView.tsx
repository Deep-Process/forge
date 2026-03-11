"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import type { ContextSection } from "@/lib/types";

interface ContextViewProps {
  sections: ContextSection[];
  totalTokens: number;
}

function tokenColor(count: number): string {
  if (count > 8000) return "text-red-600";
  if (count > 4000) return "text-yellow-600";
  return "text-green-600";
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function ContextView({ sections, totalTokens }: ContextViewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Expand all sections by default
    const init: Record<string, boolean> = {};
    for (const s of sections) {
      init[s.name] = true;
    }
    return init;
  });

  const toggle = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of sections) next[s.name] = true;
    setExpanded(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of sections) next[s.name] = false;
    setExpanded(next);
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            Assembled Context
          </span>
          <span className="text-xs text-gray-400">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-mono font-semibold ${tokenColor(totalTokens)}`}>
            {formatTokens(totalTokens)} tokens
          </span>
          <div className="flex gap-1">
            <button
              onClick={expandAll}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
              title="Expand all"
            >
              Expand all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
              title="Collapse all"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = expanded[section.name] ?? false;
          return (
            <div
              key={section.name}
              className="rounded-lg border bg-white overflow-hidden"
            >
              {/* Section header */}
              <button
                onClick={() => toggle(section.name)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 select-none">
                    {isOpen ? "\u25BC" : "\u25B6"}
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {section.header}
                  </span>
                  {section.was_truncated && (
                    <Badge variant="warning">truncated</Badge>
                  )}
                </div>
                <span
                  className={`text-xs font-mono ${tokenColor(section.token_estimate)}`}
                >
                  {formatTokens(section.token_estimate)} tokens
                </span>
              </button>

              {/* Section content */}
              {isOpen && (
                <div className="border-t px-4 py-3">
                  {section.was_truncated && (
                    <div className="flex items-center gap-2 mb-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2">
                      <span className="text-xs text-yellow-700">
                        This section was truncated to fit token limits. Some content may be missing.
                      </span>
                    </div>
                  )}
                  <pre className="text-xs font-mono text-gray-700 bg-gray-50 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {section.content}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="rounded-lg border bg-gray-50 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">
            No context sections assembled for this task.
          </p>
        </div>
      )}
    </div>
  );
}

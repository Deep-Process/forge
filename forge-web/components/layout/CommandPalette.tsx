"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { useCommandPaletteSearch, type SearchResult } from "@/lib/hooks/useCommandPalette";

export function CommandPalette() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, quickActions } = useCommandPaletteSearch(slug, query);

  // Total selectable items: results + quick actions
  const totalItems = results.length + quickActions.length;

  // Global keyboard shortcut
  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    setOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, { enableOnFormTags: true });

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const selectResult = useCallback(
    (result: SearchResult) => {
      close();
      router.push(result.href);
    },
    [close, router],
  );

  const selectQuickAction = useCallback(
    (action: string) => {
      close();
      // Quick actions will be wired to form drawers in T-057
      // For now, navigate to the relevant list page
      switch (action) {
        case "new-task":
          router.push(`/projects/${slug}/tasks`);
          break;
        case "new-idea":
          router.push(`/projects/${slug}/ideas`);
          break;
        case "new-decision":
          router.push(`/projects/${slug}/decisions`);
          break;
      }
    },
    [close, router, slug],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex < results.length) {
            selectResult(results[selectedIndex]);
          } else {
            const actionIdx = selectedIndex - results.length;
            if (quickActions[actionIdx]) {
              selectQuickAction(quickActions[actionIdx].action);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [selectedIndex, results, quickActions, totalItems, selectResult, selectQuickAction, close],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={close}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[15%] mx-auto max-w-lg z-50">
        <div
          className="bg-white rounded-lg shadow-2xl border overflow-hidden"
          role="dialog"
          aria-label="Command palette"
        >
          {/* Search input */}
          <div className="flex items-center border-b px-4">
            <span className="text-gray-400 mr-2 text-sm">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search entities by ID or name..."
              className="flex-1 py-3 text-sm outline-none placeholder-gray-400"
              aria-label="Search entities"
              autoComplete="off"
            />
            <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {results.length > 0 && (
              <div className="py-1">
                {results.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => selectResult(result)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                      selectedIndex === idx
                        ? "bg-forge-50 text-forge-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    role="option"
                    aria-selected={selectedIndex === idx}
                  >
                    <span className="w-5 text-center text-xs" aria-hidden="true">
                      {result.icon}
                    </span>
                    <span className="font-mono text-xs text-gray-500 w-12 flex-shrink-0">
                      {result.id}
                    </span>
                    <span className="truncate flex-1">{result.title}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      {result.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {/* Quick actions */}
            <div className="border-t py-1">
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Quick Actions
              </div>
              {quickActions.map((action, idx) => {
                const actionIndex = results.length + idx;
                return (
                  <button
                    key={action.id}
                    onClick={() => selectQuickAction(action.action)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                      selectedIndex === actionIndex
                        ? "bg-forge-50 text-forge-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    role="option"
                    aria-selected={selectedIndex === actionIndex}
                  >
                    <span className="w-5 text-center text-xs text-gray-400" aria-hidden="true">
                      +
                    </span>
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

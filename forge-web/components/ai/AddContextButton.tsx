"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSidebarStore, MAX_ADDITIONAL_CONTEXTS, type AdditionalContext } from "@/stores/sidebarStore";
import { tasks, objectives, ideas, decisions, knowledge, guidelines, research } from "@/lib/api";

/** Entity type config for search results. */
const ENTITY_TYPES = [
  { type: "objective", prefix: "O-", color: "#3B82F6", label: "Objectives" },
  { type: "idea", prefix: "I-", color: "#8B5CF6", label: "Ideas" },
  { type: "task", prefix: "T-", color: "#10B981", label: "Tasks" },
  { type: "decision", prefix: "D-", color: "#F59E0B", label: "Decisions" },
  { type: "knowledge", prefix: "K-", color: "#6366F1", label: "Knowledge" },
  { type: "guideline", prefix: "G-", color: "#14B8A6", label: "Guidelines" },
  { type: "research", prefix: "R-", color: "#EC4899", label: "Research" },
] as const;

interface SearchResult {
  type: string;
  id: string;
  label: string;
}

export function AddContextButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const additionalContexts = useSidebarStore((s) => s.additionalContexts);
  const addContext = useSidebarStore((s) => s.addContext);
  const atLimit = additionalContexts.length >= MAX_ADDITIONAL_CONTEXTS;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!slug) return;
    const term = q.toLowerCase().trim();
    if (!term) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch all entity types in parallel
      const [tasksRes, objRes, ideasRes, decisionsRes, knowledgeRes, guidelinesRes, researchRes] = await Promise.allSettled([
        tasks.list(slug),
        objectives.list(slug),
        ideas.list(slug),
        decisions.list(slug),
        knowledge.list(slug),
        guidelines.list(slug),
        research.list(slug),
      ]);

      const matches: SearchResult[] = [];

      const filterItems = (items: { id: string; name?: string; title?: string; issue?: string }[], type: string) => {
        for (const item of items) {
          const name = item.name || item.title || item.issue || "";
          if (item.id.toLowerCase().includes(term) || name.toLowerCase().includes(term)) {
            matches.push({ type, id: item.id, label: name || item.id });
          }
        }
      };

      if (tasksRes.status === "fulfilled") filterItems(tasksRes.value.tasks, "task");
      if (objRes.status === "fulfilled") filterItems(objRes.value.objectives, "objective");
      if (ideasRes.status === "fulfilled") filterItems(ideasRes.value.ideas, "idea");
      if (decisionsRes.status === "fulfilled") filterItems(decisionsRes.value.decisions, "decision");
      if (knowledgeRes.status === "fulfilled") filterItems(knowledgeRes.value.knowledge, "knowledge");
      if (guidelinesRes.status === "fulfilled") filterItems(guidelinesRes.value.guidelines, "guideline");
      if (researchRes.status === "fulfilled") filterItems(researchRes.value.research, "research");

      setResults(matches.slice(0, 20));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  };

  const handleSelect = (result: SearchResult) => {
    addContext({ type: result.type, id: result.id, label: result.label });
    setQuery("");
    setResults([]);
    // Close if at limit after adding
    if (additionalContexts.length + 1 >= MAX_ADDITIONAL_CONTEXTS) {
      setOpen(false);
    }
  };

  // Clean up debounce on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Group results by entity type
  const grouped = ENTITY_TYPES
    .map((et) => ({
      ...et,
      items: results.filter((r) => r.type === et.type),
    }))
    .filter((g) => g.items.length > 0);

  // Check if an entity is already added
  const isAdded = (result: SearchResult) =>
    additionalContexts.some((c) => c.type === result.type && c.id === result.id);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !atLimit && setOpen(!open)}
        disabled={atLimit}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
          atLimit
            ? "text-gray-300 cursor-not-allowed"
            : "text-forge-600 hover:bg-forge-50 hover:text-forge-700"
        }`}
        title={atLimit ? `Maximum ${MAX_ADDITIONAL_CONTEXTS} contexts reached` : "Add entity context"}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add context
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border z-50 max-h-80 flex flex-col">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Search by ID or name..."
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-forge-400 focus:outline-none focus:ring-1 focus:ring-forge-400 placeholder:text-gray-400"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="px-3 py-2 text-[10px] text-gray-400">Searching...</div>
            )}

            {!loading && query && grouped.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>
            )}

            {!loading && !query && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Type to search entities</div>
            )}

            {grouped.map((group) => (
              <div key={group.type}>
                <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const added = isAdded(item);
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => !added && handleSelect(item)}
                      disabled={added}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                        added
                          ? "text-gray-300 cursor-default"
                          : "hover:bg-forge-50 text-gray-700"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-gray-400 shrink-0 w-10">{item.id}</span>
                      <span className="truncate flex-1">{item.label}</span>
                      {added && <span className="text-[9px] text-gray-300">added</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

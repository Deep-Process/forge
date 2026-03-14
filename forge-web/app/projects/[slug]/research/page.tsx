"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useResearchStore } from "@/stores/researchStore";
import { ResearchCard } from "@/components/entities/ResearchCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Research } from "@/lib/types";

const STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"];
const CATEGORIES = [
  "architecture",
  "domain",
  "feasibility",
  "risk",
  "business",
  "technical",
];

export default function ResearchPage() {
  const { slug } = useParams() as { slug: string };
  const { items, count, fetchAll } = useResearchStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAll(slug);
  }, [slug, fetchAll]);

  const research = items as Research[];

  const filtered = useMemo(() => {
    let result = research;
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (categoryFilter) {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.topic.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [research, statusFilter, categoryFilter, search]);

  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const r of research) {
      dist[r.status] = (dist[r.status] ?? 0) + 1;
    }
    return dist;
  }, [research]);

  // --- AI Annotations ---
  useAIPage({
    id: "research",
    title: `Research (${count})`,
    description: `Research objects for project ${slug}`,
    route: `/projects/${slug}/research`,
  });

  useAIElement({
    id: "status-filter",
    type: "filter",
    label: "Status Filter",
    value: statusFilter || "All",
    actions: [
      { label: "Filter", description: "Filter research by status" },
    ],
  });

  useAIElement({
    id: "research-list",
    type: "list",
    label: "Research Objects",
    description: `${filtered.length} shown of ${count} total`,
    data: { count, filtered: filtered.length, statuses: statusDist },
    actions: [
      {
        label: "View research",
        toolName: "viewResearch",
        toolParams: ["research_id*"],
      },
    ],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Research ({count})</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusFilter
          statuses={STATUSES}
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusDist}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, topic, tags..."
          className="text-xs border rounded px-2 py-1 w-48"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">
          {count === 0
            ? "No research objects yet. Use /discover to create research."
            : "No matching research objects."}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <ResearchCard key={r.id} research={r} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useResearchStore } from "@/stores/researchStore";
import { ResearchCard } from "@/components/entities/ResearchCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { ResearchForm } from "@/components/forms/ResearchForm";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Research } from "@/lib/types";

const STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"];
const CATEGORIES = [
  "architecture", "domain", "feasibility", "risk", "business", "technical",
];

export default function ResearchPage() {
  const { slug } = useParams() as { slug: string };
  const { items, count, fetchAll } = useResearchStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingResearch, setEditingResearch] = useState<Research | undefined>();

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

  const categoryDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const r of research) dist[r.category] = (dist[r.category] ?? 0) + 1;
    return dist;
  }, [research]);

  const handleFormSuccess = () => {
    fetchAll(slug);
  };

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
    actions: [{ label: "Filter", description: "Filter research by status" }],
  });

  useAIElement({
    id: "research-list",
    type: "list",
    label: "Research Objects",
    description: `${filtered.length} shown of ${count} total`,
    data: { count, filtered: filtered.length, categories: categoryDist },
    actions: [
      {
        label: "Create research",
        toolName: "createResearch",
        toolParams: ["title*", "topic*", "category*", "summary*"],
      },
      {
        label: "Update research",
        toolName: "updateResearch",
        toolParams: ["research_id*", "title", "status", "key_findings"],
      },
    ],
  });

  useAIElement({
    id: "research-form",
    type: "form",
    label: "Research Form",
    value: formOpen,
    description: formOpen ? `open (${editingResearch ? `editing ${editingResearch.id}` : "creating"})` : "closed",
    data: { fields: ["title*", "topic*", "category*", "summary*", "key_findings", "decision_ids"] },
    actions: [
      {
        label: editingResearch ? "Update" : "Create",
        toolName: editingResearch ? "updateResearch" : "createResearch",
        toolParams: editingResearch
          ? ["research_id*", "title", "status"]
          : ["title*", "topic*", "category*", "summary*"],
      },
    ],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Research ({count})</h2>
        <div className="flex gap-3 items-center">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <StatusFilter options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} label="Category" />
          <button
            onClick={() => { setEditingResearch(undefined); setFormOpen(true); }}
            className="px-3 py-1.5 text-sm text-white bg-forge-600 rounded-md hover:bg-forge-700"
          >
            + New Research
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, topic, summary, or tags..."
          className="w-full rounded-md border px-3 py-2 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">
          {count === 0
            ? "No research objects yet. Use /discover to create research."
            : "No matching research objects."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ResearchCard
              key={r.id}
              research={r}
              slug={slug}
              onEdit={(research) => { setEditingResearch(research); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <ResearchForm
        slug={slug}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingResearch(undefined); }}
        research={editingResearch}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

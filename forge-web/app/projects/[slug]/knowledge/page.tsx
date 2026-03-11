"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { KnowledgeCard } from "@/components/entities/KnowledgeCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import type { Knowledge } from "@/lib/types";

const STATUSES = ["DRAFT", "ACTIVE", "REVIEW_NEEDED", "DEPRECATED", "ARCHIVED"];
const CATEGORIES = [
  "domain-rules", "api-reference", "architecture", "business-context",
  "technical-context", "code-patterns", "integration", "infrastructure",
];

export default function KnowledgePage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEntities(slug, "knowledge");
  }, [slug, fetchEntities]);

  const items = slices.knowledge.items as Knowledge[];
  const filtered = items
    .filter((k) => !statusFilter || k.status === statusFilter)
    .filter((k) => !categoryFilter || k.category === categoryFilter)
    .filter((k) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        k.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Knowledge ({slices.knowledge.count})</h2>
        <div className="flex gap-3">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <StatusFilter options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} label="Category" />
        </div>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, content, or tags..."
          className="w-full rounded-md border px-3 py-2 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
        />
      </div>
      {slices.knowledge.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.knowledge.error && <p className="text-sm text-red-600 mb-2">{slices.knowledge.error}</p>}
      <div className="space-y-3">
        {filtered.map((k) => (
          <KnowledgeCard key={k.id} knowledge={k} slug={slug} />
        ))}
        {!slices.knowledge.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">
            No knowledge entries{statusFilter || categoryFilter || search ? " matching filters" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

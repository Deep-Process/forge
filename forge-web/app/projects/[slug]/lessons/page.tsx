"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { LessonCard } from "@/components/entities/LessonCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import type { Lesson } from "@/lib/types";

const CATEGORIES = [
  "pattern-discovered", "mistake-avoided", "decision-validated",
  "decision-reversed", "tool-insight", "architecture-lesson",
  "process-improvement", "market-insight",
];

export default function LessonsPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities } = useEntityStore();
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    fetchEntities(slug, "lessons");
  }, [slug, fetchEntities]);

  const lessons = slices.lessons.items as Lesson[];
  const filtered = categoryFilter
    ? lessons.filter((l) => l.category === categoryFilter)
    : lessons;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Lessons ({slices.lessons.count})</h2>
        <StatusFilter options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} label="Category" />
      </div>
      {slices.lessons.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.lessons.error && <p className="text-sm text-red-600 mb-2">{slices.lessons.error}</p>}
      <div className="space-y-3">
        {filtered.map((l) => (
          <LessonCard key={l.id} lesson={l} />
        ))}
        {!slices.lessons.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No lessons{categoryFilter ? ` in category ${categoryFilter}` : ""}</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { GuidelineCard } from "@/components/entities/GuidelineCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import type { Guideline } from "@/lib/types";

const STATUSES = ["ACTIVE", "DEPRECATED"];
const WEIGHTS = ["must", "should", "may"];

export default function GuidelinesPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [weightFilter, setWeightFilter] = useState("");

  useEffect(() => {
    fetchEntities(slug, "guidelines");
  }, [slug, fetchEntities]);

  const guidelines = slices.guidelines.items as Guideline[];
  const filtered = guidelines
    .filter((g) => !statusFilter || g.status === statusFilter)
    .filter((g) => !weightFilter || g.weight === weightFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Guidelines ({slices.guidelines.count})</h2>
        <div className="flex gap-3">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <StatusFilter options={WEIGHTS} value={weightFilter} onChange={setWeightFilter} label="Weight" />
        </div>
      </div>
      {slices.guidelines.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.guidelines.error && <p className="text-sm text-red-600 mb-2">{slices.guidelines.error}</p>}
      <div className="space-y-3">
        {filtered.map((g) => (
          <GuidelineCard key={g.id} guideline={g} />
        ))}
        {!slices.guidelines.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No guidelines matching filters</p>
        )}
      </div>
    </div>
  );
}

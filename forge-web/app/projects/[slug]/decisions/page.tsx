"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { DecisionCard } from "@/components/entities/DecisionCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import type { Decision } from "@/lib/types";

const STATUSES = ["OPEN", "CLOSED", "DEFERRED", "ANALYZING", "MITIGATED", "ACCEPTED"];

export default function DecisionsPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities, updateDecision } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchEntities(slug, "decisions");
  }, [slug, fetchEntities]);

  const decisions = slices.decisions.items as Decision[];
  const filtered = statusFilter
    ? decisions.filter((d) => d.status === statusFilter)
    : decisions;

  const handleClose = (id: string) => {
    updateDecision(slug, id, { status: "CLOSED" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Decisions ({slices.decisions.count})</h2>
        <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
      </div>
      {slices.decisions.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.decisions.error && <p className="text-sm text-red-600 mb-2">{slices.decisions.error}</p>}
      <div className="space-y-3">
        {filtered.map((d) => (
          <DecisionCard key={d.id} decision={d} onClose={handleClose} />
        ))}
        {!slices.decisions.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No decisions{statusFilter ? ` with status ${statusFilter}` : ""}</p>
        )}
      </div>
    </div>
  );
}

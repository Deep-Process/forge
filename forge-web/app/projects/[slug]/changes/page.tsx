"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { ChangeCard } from "@/components/entities/ChangeCard";
import type { ChangeRecord } from "@/lib/types";

export default function ChangesPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities } = useEntityStore();
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    fetchEntities(slug, "changes");
  }, [slug, fetchEntities]);

  const changes = slices.changes.items as ChangeRecord[];
  const filtered = actionFilter
    ? changes.filter((c) => c.action === actionFilter)
    : changes;
  const sorted = [...filtered].reverse(); // newest first

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Changes ({slices.changes.count})</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          >
            <option value="">All</option>
            {["create", "edit", "delete", "rename", "move"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      {slices.changes.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.changes.error && <p className="text-sm text-red-600 mb-2">{slices.changes.error}</p>}
      <div className="space-y-3">
        {sorted.map((c) => (
          <ChangeCard key={c.id} change={c} />
        ))}
        {!slices.changes.loading && sorted.length === 0 && (
          <p className="text-sm text-gray-400">No changes{actionFilter ? ` with action ${actionFilter}` : ""}</p>
        )}
      </div>
    </div>
  );
}

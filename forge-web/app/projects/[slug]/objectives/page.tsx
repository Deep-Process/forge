"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { ObjectiveCard } from "@/components/entities/ObjectiveCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { ObjectiveForm } from "@/components/forms/ObjectiveForm";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Objective } from "@/lib/types";

const STATUSES = ["ACTIVE", "ACHIEVED", "ABANDONED", "PAUSED"];

export default function ObjectivesPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | undefined>();

  useEffect(() => {
    fetchEntities(slug, "objectives");
  }, [slug, fetchEntities]);

  const objectives = slices.objectives.items as Objective[];
  const filtered = statusFilter
    ? objectives.filter((o) => o.status === statusFilter)
    : objectives;

  // ---------------------------------------------------------------------------
  // AI Annotations
  // ---------------------------------------------------------------------------

  useAIPage({
    id: "objectives",
    title: `Objectives (${slices.objectives.count})`,
    description: `Business objectives for project ${slug}`,
    route: `/projects/${slug}/objectives`,
  });

  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const o of objectives) {
      dist[o.status] = (dist[o.status] ?? 0) + 1;
    }
    return dist;
  }, [objectives]);

  useAIElement({
    id: "status-filter",
    type: "filter",
    label: "Status Filter",
    value: statusFilter || "All",
    actions: [{ label: "Filter", description: "Filter objectives by status" }],
  });

  useAIElement({
    id: "objective-list",
    type: "list",
    label: "Objectives",
    description: `${filtered.length} shown of ${slices.objectives.count} total`,
    data: {
      count: slices.objectives.count,
      filtered: filtered.length,
      statuses: statusDist,
    },
    actions: [
      { label: "Update KR progress", toolName: "updateObjective", toolParams: ["id*", "key_results[{id, current, status}]"], availableWhen: "status = ACTIVE" },
      { label: "Mark achieved", toolName: "updateObjective", toolParams: ["id*", "status=ACHIEVED"], availableWhen: "status = ACTIVE" },
      { label: "Abandon", toolName: "updateObjective", toolParams: ["id*", "status=ABANDONED"], availableWhen: "status = ACTIVE" },
      { label: "Pause", toolName: "updateObjective", toolParams: ["id*", "status=PAUSED"], availableWhen: "status = ACTIVE" },
      { label: "Create objective", toolName: "createObjective", toolParams: ["title*", "description*", "key_results*", "appetite", "scopes"] },
    ],
  });

  useAIElement({
    id: "objective-form",
    type: "form",
    label: "Objective Form",
    value: formOpen,
    description: formOpen ? `open (${editingObj ? `editing ${editingObj.id}` : "creating"})` : "closed",
    data: {
      fields: ["title*", "description*", "key_results*", "appetite", "scope", "assumptions", "tags", "scopes"],
    },
    actions: [
      {
        label: editingObj ? "Update" : "Create",
        toolName: editingObj ? "updateObjective" : "createObjective",
        toolParams: editingObj
          ? ["id*", "status", "key_results"]
          : ["title*", "description*", "key_results*", "appetite", "scopes"],
      },
    ],
  });

  const handleFormSuccess = useCallback(() => {
    fetchEntities(slug, "objectives");
  }, [slug, fetchEntities]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Objectives ({slices.objectives.count})</h2>
        <div className="flex items-center gap-3">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <button
            onClick={() => { setEditingObj(undefined); setFormOpen(true); }}
            className="px-3 py-1.5 text-sm text-white bg-forge-600 rounded-md hover:bg-forge-700"
          >
            + New Objective
          </button>
        </div>
      </div>
      {slices.objectives.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.objectives.error && <p className="text-sm text-red-600 mb-2">{slices.objectives.error}</p>}
      <div className="space-y-3">
        {filtered.map((o) => (
          <ObjectiveCard key={o.id} objective={o} slug={slug} onEdit={(obj) => { setEditingObj(obj); setFormOpen(true); }} />
        ))}
        {!slices.objectives.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No objectives{statusFilter ? ` with status ${statusFilter}` : ""}</p>
        )}
      </div>

      <ObjectiveForm
        slug={slug}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingObj(undefined); }}
        objective={editingObj}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { TaskCard } from "@/components/entities/TaskCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { SuggestionPanel } from "@/components/ai/SuggestionPanel";
import type { Task } from "@/lib/types";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "CLAIMING"];

export default function TasksPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities, updateTask } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchEntities(slug, "tasks");
  }, [slug, fetchEntities]);

  const tasks = slices.tasks.items as Task[];
  const filtered = statusFilter
    ? tasks.filter((t) => t.status === statusFilter)
    : tasks;

  const handleStatusChange = (id: string, status: string) => {
    updateTask(slug, id, { status: status as Task["status"] });
  };

  const handleTaskSelect = (id: string) => {
    setSelectedTaskId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tasks ({slices.tasks.count})</h2>
        <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
      </div>
      {slices.tasks.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.tasks.error && (
        <p className="text-sm text-red-600 mb-2">{slices.tasks.error}</p>
      )}
      <div className="space-y-3">
        {filtered.map((task) => (
          <div
            key={task.id}
            onClick={() => handleTaskSelect(task.id)}
            className={`cursor-pointer rounded-lg transition-shadow ${
              selectedTaskId === task.id
                ? "ring-2 ring-forge-500 shadow-md"
                : ""
            }`}
          >
            <TaskCard task={task} onStatusChange={handleStatusChange} />
          </div>
        ))}
        {!slices.tasks.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No tasks{statusFilter ? ` with status ${statusFilter}` : ""}</p>
        )}
      </div>

      {/* AI Suggestion Panel — shows when a task is selected */}
      {selectedTaskId && (
        <SuggestionPanel
          entityType="task"
          entityId={selectedTaskId}
          suggestionTypes={["knowledge", "guidelines", "ac"]}
        />
      )}
    </div>
  );
}

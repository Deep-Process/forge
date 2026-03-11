"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { TaskCard } from "@/components/entities/TaskCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import type { Task } from "@/lib/types";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "CLAIMING"];

export default function TasksPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities, updateTask } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");

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
          <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
        ))}
        {!slices.tasks.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No tasks{statusFilter ? ` with status ${statusFilter}` : ""}</p>
        )}
      </div>
    </div>
  );
}

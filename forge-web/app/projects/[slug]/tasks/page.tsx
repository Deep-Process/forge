"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useEntityData } from "@/hooks/useEntityData";
import { useTaskStore, updateTask as updateTaskAction } from "@/stores/taskStore";
import { TaskCard } from "@/components/entities/TaskCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { SuggestionPanel } from "@/components/ai/SuggestionPanel";
import { TaskForm } from "@/components/forms/TaskForm";
import type { Task } from "@/lib/types";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "CLAIMING"];

export default function TasksPage() {
  const { slug } = useParams() as { slug: string };
  const { items, count, isLoading, error, mutate } = useEntityData<Task>(slug, "tasks");
  const saving = useTaskStore((s) => s.saving);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const tasks = items;
  const filtered = statusFilter
    ? tasks.filter((t) => t.status === statusFilter)
    : tasks;

  const handleStatusChange = (id: string, status: string) => {
    updateTaskAction(slug, id, { status: status as Task["status"] });
  };

  const handleTaskSelect = (id: string) => {
    setSelectedTaskId((prev) => (prev === id ? null : id));
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingTask(undefined);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingTask(undefined);
  };

  const handleFormSuccess = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Tasks ({count})
          {saving && <span className="ml-2 text-xs text-gray-400">Saving...</span>}
        </h2>
        <div className="flex items-center gap-3">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-sm text-white bg-forge-600 rounded-md hover:bg-forge-700"
          >
            + New Task
          </button>
        </div>
      </div>
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && (
        <p className="text-sm text-red-600 mb-2">{error}</p>
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
            <TaskCard task={task} slug={slug} onStatusChange={handleStatusChange} onEdit={handleEdit} />
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No tasks{statusFilter ? ` with status ${statusFilter}` : ""}</p>
        )}
      </div>

      {selectedTaskId && (
        <SuggestionPanel
          entityType="task"
          entityId={selectedTaskId}
          suggestionTypes={["knowledge", "guidelines", "ac"]}
        />
      )}

      <TaskForm
        slug={slug}
        open={formOpen}
        onClose={handleFormClose}
        task={editingTask}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

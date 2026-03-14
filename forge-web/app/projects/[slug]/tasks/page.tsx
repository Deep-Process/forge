"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useEntityData } from "@/hooks/useEntityData";
import { useTaskStore, updateTask as updateTaskAction } from "@/stores/taskStore";
import { tasks as tasksApi } from "@/lib/api";
import { TaskCard } from "@/components/entities/TaskCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { SuggestionPanel } from "@/components/ai/SuggestionPanel";
import { TaskForm } from "@/components/forms/TaskForm";
import { DraftPlanView } from "@/components/planning/DraftPlanView";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Task, DraftPlan } from "@/lib/types";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "CLAIMING"];

export default function TasksPage() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const { items, count, isLoading, error, mutate } = useEntityData<Task>(slug, "tasks");
  const saving = useTaskStore((s) => s.saving);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [draft, setDraft] = useState<DraftPlan | null>(null);

  // Load draft plan if one exists
  useEffect(() => {
    tasksApi.getDraft(slug).then(setDraft).catch(() => setDraft(null));
  }, [slug]);

  const tasks = items;
  const filtered = statusFilter
    ? tasks.filter((t) => t.status === statusFilter)
    : tasks;

  // ---------------------------------------------------------------------------
  // AI Annotations
  // ---------------------------------------------------------------------------

  useAIPage({
    id: "tasks",
    title: `Tasks (${count})`,
    description: `Task list for project ${slug}`,
    route: `/projects/${slug}/tasks`,
  });

  // Status distribution for AI context
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const t of tasks) {
      dist[t.status] = (dist[t.status] ?? 0) + 1;
    }
    return dist;
  }, [tasks]);

  useAIElement({
    id: "status-filter",
    type: "filter",
    label: "Status Filter",
    value: statusFilter || "All",
    actions: [{ label: "Filter", description: "Filter tasks by status" }],
  });

  useAIElement({
    id: "task-list",
    type: "list",
    label: "Tasks",
    description: `${filtered.length} shown of ${count} total`,
    data: {
      count,
      filtered: filtered.length,
      statuses: statusDist,
    },
    actions: [
      {
        label: "Start task",
        toolName: "updateTask",
        toolParams: ["task_id*", "status=IN_PROGRESS"],
        availableWhen: "status = TODO",
      },
      {
        label: "Skip task",
        toolName: "updateTask",
        toolParams: ["task_id*", "status=SKIPPED"],
        availableWhen: "status = TODO",
      },
      {
        label: "Complete task",
        toolName: "completeTask",
        toolParams: ["task_id*", "reasoning"],
        availableWhen: "status = IN_PROGRESS",
      },
      {
        label: "Create task",
        toolName: "createTask",
        toolParams: ["name*", "description", "type*", "scopes", "depends_on", "acceptance_criteria"],
      },
    ],
  });

  useAIElement({
    id: "task-form",
    type: "form",
    label: "Task Form",
    value: formOpen,
    description: formOpen ? `open (${editingTask ? `editing ${editingTask.id}` : "creating"})` : "closed",
    data: {
      fields: ["name*", "description", "instruction", "type*", "scopes", "skill_id", "acceptance_criteria", "depends_on"],
    },
    actions: [
      {
        label: editingTask ? "Update" : "Create",
        toolName: editingTask ? "updateTask" : "createTask",
        toolParams: editingTask
          ? ["task_id*", "name", "description", "depends_on", "scopes"]
          : ["name*", "description", "type*", "scopes", "depends_on", "acceptance_criteria"],
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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
      {/* Draft plan banner */}
      {draft && (
        <div className="mb-4">
          <DraftPlanView
            slug={slug}
            draft={draft}
            onApproved={() => { setDraft(null); mutate(); }}
            onDiscarded={() => setDraft(null)}
          />
        </div>
      )}
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

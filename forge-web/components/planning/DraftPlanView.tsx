"use client";

import { useState, useCallback } from "react";
import { tasks as tasksApi } from "@/lib/api";
import { useTaskStore } from "@/stores/taskStore";
import { useToastStore } from "@/stores/toastStore";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { useAIElement } from "@/lib/ai-context";
import type { DraftPlan, DraftTaskItem } from "@/lib/types";

interface DraftPlanViewProps {
  slug: string;
  draft: DraftPlan;
  onApproved: () => void;
  onDiscarded: () => void;
}

export function DraftPlanView({ slug, draft, onApproved, onDiscarded }: DraftPlanViewProps) {
  const [approving, setApproving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await tasksApi.approvePlan(slug);
      useTaskStore.getState().fetchAll(slug);
      useToastStore.getState().addToast({
        message: `Plan approved — ${draft.tasks.length} tasks materialized`,
        action: "completed",
      });
      onApproved();
    } catch (e) {
      useToastStore.getState().addToast({
        message: `Approve failed: ${(e as Error).message}`,
        action: "failed",
      });
    } finally {
      setApproving(false);
    }
  }, [slug, draft.tasks.length, onApproved]);

  const handleDiscard = useCallback(async () => {
    setDiscarding(true);
    try {
      await tasksApi.discardDraft(slug);
      useToastStore.getState().addToast({
        message: "Draft plan discarded",
        action: "info",
      });
      onDiscarded();
    } catch (e) {
      useToastStore.getState().addToast({
        message: `Discard failed: ${(e as Error).message}`,
        action: "failed",
      });
    } finally {
      setDiscarding(false);
      setConfirmDiscard(false);
    }
  }, [slug, onDiscarded]);

  // Build dependency graph for simple visualization
  const taskIds = new Set(draft.tasks.map((t) => t.id));
  const roots = draft.tasks.filter(
    (t) => !t.depends_on?.length || t.depends_on.every((d) => !taskIds.has(d))
  );

  // AI annotations
  useAIElement({
    id: "draft-plan-view",
    type: "section",
    label: "Draft Plan",
    description: `${draft.tasks.length} tasks, ${draft.source_idea_id ? `from idea ${draft.source_idea_id}` : draft.source_objective_id ? `from objective ${draft.source_objective_id}` : "standalone"}`,
    data: {
      task_count: draft.tasks.length,
      source_idea: draft.source_idea_id,
      source_objective: draft.source_objective_id,
    },
    actions: [
      { label: "Approve plan", toolName: "approvePlan", toolParams: [] },
      { label: "Discard plan", toolName: "discardDraft", toolParams: [] },
    ],
  });

  return (
    <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-yellow-600">Draft Plan</span>
            <Badge variant="warning">{draft.tasks.length} tasks</Badge>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Created: {new Date(draft.created).toLocaleString()}
            {draft.source_idea_id && <span className="ml-2">from {draft.source_idea_id}</span>}
            {draft.source_objective_id && <span className="ml-2">from {draft.source_objective_id}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {confirmDiscard ? (
            <>
              <span className="text-xs text-red-600 self-center">Are you sure?</span>
              <button
                onClick={handleDiscard}
                disabled={discarding}
                className="px-3 py-1.5 text-xs text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {discarding ? "Discarding..." : "Yes, discard"}
              </button>
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDiscard(true)}
                className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                Discard
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-3 py-1.5 text-xs text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? "Approving..." : "Approve Plan"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {draft.tasks.map((task) => (
          <DraftTaskCard
            key={task.id}
            task={task}
            allTasks={draft.tasks}
            expanded={expandedTask === task.id}
            onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
          />
        ))}
      </div>

      {/* Simple dependency overview */}
      <div className="text-xs text-gray-500 border-t border-yellow-200 pt-2">
        <span className="font-medium">Root tasks: </span>
        {roots.map((r) => r.id).join(", ") || "none"}
        <span className="ml-4 font-medium">Total deps: </span>
        {draft.tasks.reduce((sum, t) => sum + (t.depends_on?.length ?? 0), 0)}
      </div>
    </div>
  );
}

function DraftTaskCard({
  task,
  allTasks,
  expanded,
  onToggle,
}: {
  task: DraftTaskItem;
  allTasks: DraftTaskItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-start justify-between">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          <span className="text-[10px] text-gray-400 font-mono">{task.id}</span>
          <span className="text-sm font-medium">{task.name}</span>
          {task.type && task.type !== "feature" && (
            <Badge variant="default">{task.type}</Badge>
          )}
          {task.depends_on && task.depends_on.length > 0 && (
            <span className="text-[10px] text-gray-400">
              deps: {task.depends_on.join(", ")}
            </span>
          )}
        </button>
        <span className="text-[10px] text-gray-300">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 text-xs text-gray-600">
          {task.description && (
            <div>
              <span className="font-medium text-gray-500">Description: </span>
              {task.description}
            </div>
          )}
          {task.instruction && (
            <div>
              <span className="font-medium text-gray-500">Instruction: </span>
              <span className="whitespace-pre-wrap">{task.instruction}</span>
            </div>
          )}
          {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
            <div>
              <span className="font-medium text-gray-500">Acceptance Criteria:</span>
              <ul className="list-disc list-inside ml-2">
                {task.acceptance_criteria.map((ac, i) => (
                  <li key={i}>{typeof ac === "string" ? ac : JSON.stringify(ac)}</li>
                ))}
              </ul>
            </div>
          )}
          {task.scopes && task.scopes.length > 0 && (
            <div>
              <span className="font-medium text-gray-500">Scopes: </span>
              {task.scopes.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

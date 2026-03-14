"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { tasks as tasksApi, execution as executionApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { EntityLink } from "@/components/shared/EntityLink";
import { ContextPanel } from "@/components/execution/ContextPanel";
import { ExecutionStream } from "@/components/execution/ExecutionStream";
import { ProgressTracker } from "@/components/execution/ProgressTracker";
import { VerificationPanel } from "@/components/execution/VerificationPanel";
import { GuidelinesChecklist, parseGuidelines } from "@/components/execution/GuidelinesChecklist";
import { GateRunner } from "@/components/execution/GateRunner";
import { DecisionRecordForm } from "@/components/execution/DecisionRecordForm";
import { ChangeRecordForm } from "@/components/execution/ChangeRecordForm";
import { CompletionDialog } from "@/components/execution/CompletionDialog";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Task, TaskContext, ExecutionStatus, TokenUsage } from "@/lib/types";
import type { ACVerification } from "@/components/execution/VerificationPanel";
import type { GuidelineVerification } from "@/components/execution/GuidelinesChecklist";
import type { GateRunnerState } from "@/components/execution/GateRunner";

export default function ExecutionPage() {
  const { slug, taskId } = useParams() as { slug: string; taskId: string };
  const router = useRouter();

  // Task & Context state
  const [task, setTask] = useState<Task | null>(null);
  const [ctx, setCtx] = useState<TaskContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  // Execution state
  const [execStatus, setExecStatus] = useState<ExecutionStatus>("pending");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ input_tokens: 0, output_tokens: 0 });
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  // Panel collapse state (progressive disclosure)
  const [panels, setPanels] = useState({
    context: true,
    decisions: false,
    changes: false,
    verification: false,
  });

  // Completion dialog
  const [completionOpen, setCompletionOpen] = useState(false);

  // Verification state (lifted for CompletionDialog)
  const [acVerifications, setAcVerifications] = useState<ACVerification[]>([]);
  const [guidelineVerifications, setGuidelineVerifications] = useState<GuidelineVerification[]>([]);
  const [gateState, setGateState] = useState<GateRunnerState>({
    ran: false,
    allRequiredPassed: true,
    results: [],
  });

  // AI page annotation
  useAIPage({
    id: "execution-v2",
    title: `Executing ${taskId}`,
    description: task ? `${task.name} — ${task.status}` : `Task execution for ${taskId}`,
    route: `/projects/${slug}/execution/${taskId}`,
  });

  // Load task + context on mount
  const fetchContext = useCallback(async () => {
    setCtxLoading(true);
    setCtxError(null);
    try {
      const [taskData, ctxData] = await Promise.all([
        tasksApi.get(slug, taskId),
        tasksApi.context(slug, taskId),
      ]);
      setTask(taskData);
      setCtx(ctxData);
    } catch (e) {
      setCtxError((e as Error).message);
    } finally {
      setCtxLoading(false);
    }
  }, [slug, taskId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Check for existing execution status
  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      try {
        const state = await executionApi.status(slug, taskId);
        if (cancelled) return;
        setExecStatus(state.status);
        setTokenUsage(state.token_usage);
        setStartedAt(state.started_at);
        setCompletedAt(state.completed_at);
        if (state.status === "running") setStreamActive(true);
      } catch {
        // No existing execution
      }
    }
    checkStatus();
    return () => { cancelled = true; };
  }, [slug, taskId]);

  // Parse guidelines from context for the checklist
  const guidelineItems = useMemo(() => {
    if (!ctx) return [];
    const guidelinesSection = ctx.sections.find((s) => s.name === "guidelines");
    if (!guidelinesSection) return [];
    return parseGuidelines(guidelinesSection.content);
  }, [ctx]);

  // Handlers
  const handleStart = useCallback(async () => {
    setStarting(true);
    setExecError(null);
    try {
      const state = await executionApi.start(slug, taskId);
      setExecStatus(state.status);
      setStartedAt(state.started_at);
      setTokenUsage(state.token_usage);
      setStreamActive(true);
    } catch (e) {
      setExecError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, [slug, taskId]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      const state = await executionApi.cancel(slug, taskId);
      setExecStatus(state.status);
      setCompletedAt(state.completed_at);
    } catch (e) {
      setExecError((e as Error).message);
    } finally {
      setCancelling(false);
    }
  }, [slug, taskId]);

  const handleStreamStatus = useCallback((status: ExecutionStatus) => {
    setExecStatus(status);
    if (status === "running") setStartedAt((prev) => prev ?? new Date().toISOString());
    if (status === "completed" || status === "failed" || status === "cancelled") {
      setCompletedAt(new Date().toISOString());
    }
  }, []);

  const handleStreamTokenUsage = useCallback((usage: TokenUsage) => {
    setTokenUsage(usage);
  }, []);

  const handleStreamError = useCallback((error: string) => {
    setExecError(error);
  }, []);

  const handleStreamDone = useCallback(() => {
    setStreamActive(false);
  }, []);

  const togglePanel = (panel: keyof typeof panels) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const canStart = execStatus === "pending" && !starting && !streamActive;
  const isTerminal = execStatus === "completed" || execStatus === "failed" || execStatus === "cancelled";
  const canComplete = task?.status === "IN_PROGRESS" && !completionOpen;

  // AI annotation for complete button
  useAIElement({
    id: "complete-task-btn",
    type: "button",
    label: "Complete Task",
    description: canComplete ? "Opens completion dialog" : "Not available",
    data: { canComplete, taskStatus: task?.status },
    actions: [{
      label: "Open completion dialog",
      toolName: "openCompletionDialog",
      toolParams: [],
      availableWhen: "task is IN_PROGRESS",
    }],
  });

  return (
    <div className="flex flex-col h-full">
      {/* ── HEADER ── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            &larr; Back
          </button>
          <span className="text-xs text-gray-400">{taskId}</span>
          {task && (
            <>
              <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
              <Badge>{task.type}</Badge>
              {task.origin && (
                <span className="text-xs text-gray-400">
                  from <EntityLink id={task.origin} />
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {task ? task.name : taskId}
          </h2>
          <div className="flex items-center gap-2">
            {canStart && (
              <button
                onClick={handleStart}
                disabled={starting || ctxLoading}
                className="px-3 py-1.5 text-sm text-white bg-forge-600 rounded-md hover:bg-forge-700 disabled:opacity-50"
              >
                {starting ? "Starting..." : "Start Execution"}
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setCompletionOpen(true)}
                className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Complete Task
              </button>
            )}
          </div>
        </div>
        {task?.description && (
          <p className="text-sm text-gray-500 mt-1">{task.description}</p>
        )}
      </div>

      {/* Error banner */}
      {(execError || ctxError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-600">{execError || ctxError}</p>
        </div>
      )}

      {/* ── MAIN LAYOUT: 2 columns ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── LEFT COLUMN: Context + Decisions + Changes ── */}
        <div className="lg:col-span-1 min-h-0 overflow-y-auto space-y-3">
          {/* Context Panel */}
          <CollapsibleSection
            title="Context"
            open={panels.context}
            onToggle={() => togglePanel("context")}
          >
            {ctxLoading ? (
              <p className="text-sm text-gray-400 p-4">Assembling context...</p>
            ) : ctx ? (
              <ContextPanel slug={slug} taskId={taskId} />
            ) : (
              <p className="text-sm text-gray-400 p-4">No context available.</p>
            )}
          </CollapsibleSection>

          {/* Decisions Panel */}
          <DecisionRecordForm slug={slug} taskId={taskId} />

          {/* Changes Panel */}
          <ChangeRecordForm slug={slug} taskId={taskId} />
        </div>

        {/* ── CENTER+RIGHT: Execution + Verification ── */}
        <div className="lg:col-span-2 min-h-0 flex flex-col gap-4">
          {/* Execution Stream */}
          <div className="flex-1 min-h-0">
            <ExecutionStream
              slug={slug}
              taskId={taskId}
              active={streamActive}
              onStatusChange={handleStreamStatus}
              onTokenUsage={handleStreamTokenUsage}
              onError={handleStreamError}
              onDone={handleStreamDone}
            />
          </div>

          {/* Verification section */}
          <CollapsibleSection
            title="Verification"
            open={panels.verification}
            onToggle={() => togglePanel("verification")}
            badge={
              task?.acceptance_criteria && task.acceptance_criteria.length > 0
                ? `${acVerifications.filter((v) => v.checked).length}/${task.acceptance_criteria.length} AC`
                : undefined
            }
          >
            <div className="space-y-3 p-4">
              {/* Acceptance Criteria */}
              {task?.acceptance_criteria && task.acceptance_criteria.length > 0 && (
                <VerificationPanel
                  acceptanceCriteria={task.acceptance_criteria}
                  onChange={setAcVerifications}
                />
              )}

              {/* Guidelines Checklist */}
              {guidelineItems.length > 0 && (
                <GuidelinesChecklist
                  guidelines={guidelineItems}
                  onChange={setGuidelineVerifications}
                />
              )}

              {/* Gate Runner */}
              <GateRunner
                slug={slug}
                taskId={taskId}
                onChange={setGateState}
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* ── BOTTOM: Progress tracker ── */}
      <div className="mt-4">
        <ProgressTracker
          status={execStatus}
          tokenUsage={tokenUsage}
          startedAt={startedAt}
          completedAt={completedAt}
          onCancel={handleCancel}
          cancelling={cancelling}
        />
      </div>

      {/* ── COMPLETION DIALOG ── */}
      {task && (
        <CompletionDialog
          slug={slug}
          taskId={taskId}
          taskName={task.name}
          open={completionOpen}
          onClose={() => setCompletionOpen(false)}
          acVerifications={acVerifications}
          guidelineVerifications={guidelineVerifications}
          gateState={gateState}
        />
      )}
    </div>
  );
}

/** Collapsible section wrapper for progressive disclosure */
function CollapsibleSection({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 select-none">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {badge && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

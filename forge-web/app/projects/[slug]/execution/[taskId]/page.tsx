"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tasks as tasksApi, execution as executionApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { ContextView } from "@/components/execution/ContextView";
import { ExecutionStream } from "@/components/execution/ExecutionStream";
import { ProgressTracker } from "@/components/execution/ProgressTracker";
import { useAIPage } from "@/lib/ai-context";
import type { TaskContext, ExecutionStatus, TokenUsage } from "@/lib/types";

export default function ExecutionPage() {
  const { slug, taskId } = useParams() as { slug: string; taskId: string };
  const router = useRouter();

  useAIPage({
    id: "execution",
    title: `Executing ${taskId}`,
    description: `Task execution view for ${taskId} in project ${slug}`,
    route: `/projects/${slug}/execution/${taskId}`,
  });

  // Context state
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

  // Load task context on mount
  const fetchContext = useCallback(async () => {
    setCtxLoading(true);
    setCtxError(null);
    try {
      const data = await tasksApi.context(slug, taskId);
      setCtx(data);
    } catch (e) {
      setCtxError((e as Error).message);
    } finally {
      setCtxLoading(false);
    }
  }, [slug, taskId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Check for existing execution status on mount
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
        if (state.status === "running") {
          setStreamActive(true);
        }
      } catch {
        // No existing execution, that's fine
      }
    }
    checkStatus();
    return () => { cancelled = true; };
  }, [slug, taskId]);

  // Start execution
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

  // Cancel execution
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

  // Stream callbacks
  const handleStreamStatus = useCallback((status: ExecutionStatus) => {
    setExecStatus(status);
    if (status === "running") {
      setStartedAt((prev) => prev ?? new Date().toISOString());
    }
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

  const isTerminal = execStatus === "completed" || execStatus === "failed" || execStatus === "cancelled";
  const canStart = execStatus === "pending" && !starting && !streamActive;

  const task = ctx?.task;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            &larr; Back
          </button>
          {task && (
            <>
              <span className="text-xs text-gray-400">{task.id}</span>
              <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
              <Badge>{task.type}</Badge>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {task ? `Execute: ${task.name}` : `Execute: ${taskId}`}
          </h2>
          {canStart && (
            <Button onClick={handleStart} disabled={starting || ctxLoading}>
              {starting ? "Starting..." : "Start Execution"}
            </Button>
          )}
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

      {/* Main content: side-by-side layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left panel: Context */}
        <div className="min-h-0 overflow-y-auto rounded-lg border bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Context</h3>
            <button
              onClick={fetchContext}
              className="text-xs text-forge-600 hover:text-forge-700 font-medium"
            >
              Refresh
            </button>
          </div>
          {ctxLoading && (
            <p className="text-sm text-gray-400">Assembling context...</p>
          )}
          {!ctxLoading && ctx && (
            <ContextView
              sections={ctx.sections}
              totalTokens={ctx.total_token_estimate}
            />
          )}
          {!ctxLoading && !ctx && !ctxError && (
            <p className="text-sm text-gray-400">No context available.</p>
          )}
        </div>

        {/* Right panel: Execution stream */}
        <div className="min-h-0 flex flex-col">
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
      </div>

      {/* Bottom bar: Progress tracker */}
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
    </div>
  );
}

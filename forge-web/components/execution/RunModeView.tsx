"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { tasks as tasksApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Task } from "@/lib/types";

type RunStatus = "idle" | "running" | "paused" | "stopped" | "completed" | "failed";

interface RunLog {
  taskId: string;
  taskName: string;
  status: "done" | "failed" | "skipped";
  message: string;
  timestamp: string;
}

interface RunModeViewProps {
  slug: string;
  agentName?: string;
}

export function RunModeView({ slug, agentName }: RunModeViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load tasks
  const loadTasks = useCallback(async () => {
    try {
      const res = await tasksApi.list(slug);
      setTasks(res.tasks ?? []);
    } catch {
      // non-critical
    }
  }, [slug]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Elapsed timer
  useEffect(() => {
    if (runStatus === "running" && startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runStatus, startTime]);

  // Stats
  const todoTasks = tasks.filter((t) => t.status === "TODO");
  const doneTasks = tasks.filter((t) => t.status === "DONE");
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
  const failedTasks = tasks.filter((t) => t.status === "FAILED");
  const totalTasks = tasks.length;
  const completedInRun = logs.filter((l) => l.status === "done").length;
  const failedInRun = logs.filter((l) => l.status === "failed").length;
  const progressPct = totalTasks > 0 ? Math.round(doneTasks.length / totalTasks * 100) : 0;

  const addLog = useCallback((entry: RunLog) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const handleStart = useCallback(async () => {
    setRunStatus("running");
    setError(null);
    setLogs([]);
    setStartTime(Date.now());
    pauseRef.current = false;
    stopRef.current = false;

    // Run loop
    let consecutiveFailures = 0;
    while (!stopRef.current) {
      // Check pause
      while (pauseRef.current && !stopRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (stopRef.current) break;

      try {
        // Claim next task
        const task = await tasksApi.claimNext(slug, agentName || undefined);
        if (!task) {
          // No more tasks
          setRunStatus("completed");
          break;
        }
        setCurrentTaskId(task.id);
        consecutiveFailures = 0;

        // Auto-complete with minimal reasoning (UI is just orchestrating)
        try {
          await tasksApi.complete(slug, task.id, `Auto-completed via run mode${agentName ? ` (agent: ${agentName})` : ""}`);
          addLog({
            taskId: task.id,
            taskName: task.name,
            status: "done",
            message: "Completed",
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          addLog({
            taskId: task.id,
            taskName: task.name,
            status: "failed",
            message: (e as Error).message,
            timestamp: new Date().toISOString(),
          });
          consecutiveFailures++;
          if (consecutiveFailures >= 3) {
            setError("3 consecutive failures. Stopping.");
            setRunStatus("failed");
            break;
          }
        }

        // Reload tasks to update stats
        await loadTasks();
        setCurrentTaskId(null);
      } catch (e) {
        // claimNext failed — no tasks or error
        const msg = (e as Error).message;
        if (msg.includes("404") || msg.includes("No task")) {
          setRunStatus("completed");
        } else {
          setError(msg);
          setRunStatus("failed");
        }
        break;
      }
    }

    if (stopRef.current) {
      setRunStatus("stopped");
    }
    setCurrentTaskId(null);
  }, [slug, agentName, addLog, loadTasks]);

  const handlePause = () => {
    pauseRef.current = true;
    setRunStatus("paused");
  };

  const handleResume = () => {
    pauseRef.current = false;
    setRunStatus("running");
  };

  const handleStop = () => {
    stopRef.current = true;
    pauseRef.current = false;
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // AI annotations
  useAIElement({
    id: "run-mode",
    type: "section",
    label: "Run Mode",
    description: `${runStatus} — ${completedInRun} done, ${failedInRun} failed in this run`,
    data: {
      status: runStatus,
      total: totalTasks,
      todo: todoTasks.length,
      done: doneTasks.length,
      in_progress: inProgressTasks.length,
      completed_in_run: completedInRun,
      agent: agentName,
    },
    actions: [
      { label: "Start run", toolName: "startRun", toolParams: ["agent"], availableWhen: "status = idle" },
      { label: "Pause run", toolName: "pauseRun", toolParams: [], availableWhen: "status = running" },
      { label: "Stop run", toolName: "stopRun", toolParams: [], availableWhen: "status = running or paused" },
    ],
  });

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-700">Run Mode</h3>
          <Badge variant={
            runStatus === "running" ? "success" :
            runStatus === "paused" ? "warning" :
            runStatus === "completed" ? "success" :
            runStatus === "failed" ? "danger" : "default"
          }>
            {runStatus.toUpperCase()}
          </Badge>
          {agentName && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
              {agentName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {startTime && (
            <span className="text-xs font-mono text-gray-400">{formatElapsed(elapsed)}</span>
          )}
          {runStatus === "idle" && (
            <button
              onClick={handleStart}
              disabled={todoTasks.length === 0}
              className="px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              Start Run
            </button>
          )}
          {runStatus === "running" && (
            <>
              <button
                onClick={handlePause}
                className="px-3 py-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100"
              >
                Pause
              </button>
              <button
                onClick={handleStop}
                className="px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
              >
                Stop
              </button>
            </>
          )}
          {runStatus === "paused" && (
            <>
              <button
                onClick={handleResume}
                className="px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
              >
                Resume
              </button>
              <button
                onClick={handleStop}
                className="px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
              >
                Stop
              </button>
            </>
          )}
          {(runStatus === "completed" || runStatus === "failed" || runStatus === "stopped") && (
            <button
              onClick={() => { setRunStatus("idle"); setLogs([]); setStartTime(null); setElapsed(0); setError(null); loadTasks(); }}
              className="px-3 py-1.5 text-sm text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{doneTasks.length}/{totalTasks} tasks complete</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${progressPct >= 100 ? "bg-green-500" : "bg-forge-500"}`}
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Done: {doneTasks.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> In Progress: {inProgressTasks.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300" /> TODO: {todoTasks.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Failed: {failedTasks.length}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Current task indicator */}
      {currentTaskId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-blue-700">
            Processing: {currentTaskId}
          </span>
        </div>
      )}

      {/* Run log */}
      {logs.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="px-4 py-3 border-b">
            <span className="text-sm font-medium text-gray-700">Run Log ({logs.length})</span>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {logs.map((log, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${log.status === "done" ? "bg-green-500" : log.status === "failed" ? "bg-red-500" : "bg-gray-400"}`} />
                <span className="text-xs text-gray-400 w-12">{log.taskId}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{log.taskName}</span>
                <Badge variant={log.status === "done" ? "success" : log.status === "failed" ? "danger" : "default"}>
                  {log.status}
                </Badge>
                {log.status === "failed" && (
                  <span className="text-[10px] text-red-500 truncate max-w-32">{log.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task list with status indicators */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b">
          <span className="text-sm font-medium text-gray-700">All Tasks ({totalTasks})</span>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`px-4 py-2 flex items-center gap-2 ${
                currentTaskId === task.id ? "bg-blue-50" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                task.status === "DONE" ? "bg-green-500" :
                task.status === "IN_PROGRESS" ? "bg-blue-500 animate-pulse" :
                task.status === "FAILED" ? "bg-red-500" :
                task.status === "SKIPPED" ? "bg-gray-300" : "bg-gray-200"
              }`} />
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">{task.id}</span>
              <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
              <span className="text-xs text-gray-700 flex-1 truncate">{task.name}</span>
              {task.agent && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                  {task.agent}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

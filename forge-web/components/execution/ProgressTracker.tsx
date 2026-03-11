"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import type { ExecutionStatus, TokenUsage } from "@/lib/types";

interface ProgressTrackerProps {
  status: ExecutionStatus;
  tokenUsage: TokenUsage;
  startedAt: string | null;
  completedAt: string | null;
  onCancel: () => void;
  cancelling?: boolean;
}

function statusVariant(status: ExecutionStatus) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "running":
      return "info" as const;
    case "failed":
      return "danger" as const;
    case "cancelled":
      return "warning" as const;
    case "pending":
    default:
      return "default" as const;
  }
}

function statusLabel(status: ExecutionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

export function ProgressTracker({
  status,
  tokenUsage,
  startedAt,
  completedAt,
  onCancel,
  cancelling = false,
}: ProgressTrackerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (status === "running" && startedAt) {
      const start = new Date(startedAt).getTime();
      const tick = () => {
        setElapsed((Date.now() - start) / 1000);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else if (startedAt && completedAt) {
      const start = new Date(startedAt).getTime();
      const end = new Date(completedAt).getTime();
      setElapsed((end - start) / 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, startedAt, completedAt]);

  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";
  const isRunning = status === "running";

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
            </span>
          )}
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
        </div>

        {/* Duration */}
        {(isRunning || isTerminal) && startedAt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <span className="font-mono">{formatDuration(elapsed)}</span>
          </div>
        )}

        {/* Token usage */}
        {(tokenUsage.input_tokens > 0 || tokenUsage.output_tokens > 0) && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span className="font-mono">{formatTokens(tokenUsage.input_tokens)}</span>
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
              <span className="font-mono">{formatTokens(tokenUsage.output_tokens)}</span>
            </span>
            <span className="text-gray-400">tokens</span>
          </div>
        )}
      </div>

      {/* Cancel button */}
      {isRunning && (
        <Button
          variant="danger"
          size="sm"
          onClick={onCancel}
          disabled={cancelling}
        >
          {cancelling ? "Cancelling..." : "Cancel"}
        </Button>
      )}
    </div>
  );
}

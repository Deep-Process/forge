"use client";

import { useState } from "react";
import type { ChatToolCall } from "@/lib/types";

interface ToolCallBlockProps {
  toolCall: ChatToolCall;
}

function isErrorResult(result: Record<string, unknown>): boolean {
  if (result.error) return true;
  if (result.success === false) return true;
  if (typeof result.status === "string" && result.status.toLowerCase() === "error") return true;
  return false;
}

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolCall.result !== undefined;
  const isError = hasResult && isErrorResult(toolCall.result!);

  const statusBadge = !hasResult
    ? { label: "running", className: "bg-yellow-100 text-yellow-700 animate-pulse" }
    : isError
      ? { label: "error", className: "bg-red-100 text-red-700" }
      : { label: "done", className: "bg-green-100 text-green-700" };

  return (
    <div className={`my-1.5 rounded-md border text-xs ${
      isError ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100
          transition-colors rounded-md"
      >
        <span className="text-gray-400">{expanded ? "▼" : "▶"}</span>
        <span className="font-mono font-medium text-forge-700">{toolCall.name}</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-3 py-2 space-y-2">
          <div>
            <span className="font-semibold text-gray-500">Input:</span>
            <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-100 font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {hasResult && (
            <div>
              <span className={`font-semibold ${isError ? "text-red-500" : "text-gray-500"}`}>
                Result:
              </span>
              <pre className={`mt-0.5 overflow-x-auto rounded p-2 border max-h-48 overflow-y-auto font-mono ${
                isError
                  ? "bg-red-50 text-red-800 border-red-100"
                  : "bg-white text-gray-700 border-gray-100"
              }`}>
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

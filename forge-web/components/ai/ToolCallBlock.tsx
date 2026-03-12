"use client";

import { useState } from "react";
import type { ChatToolCall } from "@/lib/types";

interface ToolCallBlockProps {
  toolCall: ChatToolCall;
}

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolCall.result !== undefined;

  return (
    <div className="my-1.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100
          transition-colors rounded-md"
      >
        <span className="text-gray-400">{expanded ? "▼" : "▶"}</span>
        <span className="font-mono font-medium text-forge-700">{toolCall.name}</span>
        {hasResult ? (
          <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-green-700">done</span>
        ) : (
          <span className="ml-auto rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">running</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-3 py-2 space-y-2">
          <div>
            <span className="font-semibold text-gray-500">Input:</span>
            <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-100">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {hasResult && (
            <div>
              <span className="font-semibold text-gray-500">Result:</span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-100 max-h-48 overflow-y-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

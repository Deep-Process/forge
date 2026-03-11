"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getToken } from "@/lib/api";
import type { ExecutionStatus, ExecutionStreamChunk, TokenUsage } from "@/lib/types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

interface ExecutionStreamProps {
  slug: string;
  taskId: string;
  /** Whether the stream should connect. Set to true after starting execution. */
  active: boolean;
  /** Called when the stream receives a status update. */
  onStatusChange?: (status: ExecutionStatus) => void;
  /** Called when the stream receives token usage data. */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** Called when the stream receives an error. */
  onError?: (error: string) => void;
  /** Called when the stream is done (terminal state). */
  onDone?: () => void;
}

/**
 * Detect code blocks in streamed content and wrap them in styled containers.
 * Returns an array of segments: either plain text or code blocks.
 */
interface Segment {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    // The code block itself
    segments.push({
      type: "code",
      content: match[2],
      language: match[1] || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

export function ExecutionStream({
  slug,
  taskId,
  active,
  onStatusChange,
  onTokenUsage,
  onError,
  onDone,
}: ExecutionStreamProps) {
  const [output, setOutput] = useState("");
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const autoScrollRef = useRef(true);

  // Track if user has scrolled up manually
  const handleScroll = useCallback(() => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    // If within 50px of bottom, enable auto-scroll
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScrollRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // WebSocket connection
  useEffect(() => {
    if (!active) {
      return;
    }

    const token = getToken();
    const params = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${WS_BASE}/ws/projects/${slug}/execute/${taskId}/stream${params}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const chunk: ExecutionStreamChunk = JSON.parse(event.data);

        switch (chunk.type) {
          case "chunk":
            if (chunk.content) {
              setOutput((prev) => prev + chunk.content);
            }
            break;
          case "status":
            if (chunk.status) {
              onStatusChange?.(chunk.status);
            }
            break;
          case "token_usage":
            if (chunk.token_usage) {
              onTokenUsage?.(chunk.token_usage);
            }
            break;
          case "error":
            if (chunk.error) {
              setOutput((prev) => prev + `\n\n[ERROR] ${chunk.error}\n`);
              onError?.(chunk.error);
            }
            break;
          case "done":
            onDone?.();
            break;
        }
      } catch {
        // Non-JSON message, append as raw text
        setOutput((prev) => prev + event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      ws.close();
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
      setConnected(false);
    };
  }, [active, slug, taskId, onStatusChange, onTokenUsage, onError, onDone]);

  const copyOutput = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [output]);

  const segments = parseSegments(output);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-gray-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Output</span>
          {active && (
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? "bg-green-500" : "bg-yellow-500"
              }`}
              title={connected ? "Connected" : "Connecting..."}
            />
          )}
        </div>
        <button
          onClick={copyOutput}
          disabled={!output}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Copy output"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Streaming output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto rounded-b-lg border bg-gray-900 p-4 font-mono text-sm text-gray-100 leading-relaxed"
      >
        {output.length === 0 && !active && (
          <span className="text-gray-500">
            Start execution to see output here...
          </span>
        )}
        {output.length === 0 && active && connected && (
          <span className="text-gray-500 animate-pulse">
            Waiting for output...
          </span>
        )}
        {output.length === 0 && active && !connected && (
          <span className="text-yellow-500">
            Connecting to execution stream...
          </span>
        )}
        {segments.map((seg, i) =>
          seg.type === "code" ? (
            <div key={i} className="my-2 rounded-md bg-gray-800 border border-gray-700 overflow-hidden">
              {seg.language && (
                <div className="bg-gray-750 px-3 py-1 text-xs text-gray-400 border-b border-gray-700">
                  {seg.language}
                </div>
              )}
              <pre className="p-3 overflow-x-auto">
                <code className="text-green-300">{seg.content}</code>
              </pre>
            </div>
          ) : (
            <span key={i} className="whitespace-pre-wrap">{seg.content}</span>
          ),
        )}

        {/* Blinking cursor when running */}
        {active && connected && output.length > 0 && (
          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}

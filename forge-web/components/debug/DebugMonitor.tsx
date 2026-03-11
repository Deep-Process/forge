"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDebugSessions } from "@/hooks/useDebugSessions";
import { debug as debugApi } from "@/lib/api";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import type { DebugSession, DebugSessionSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function statusBadgeVariant(status: string): "success" | "danger" | "warning" {
  switch (status) {
    case "success": return "success";
    case "error": return "danger";
    case "validation_failed": return "warning";
    default: return "warning";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "success": return "Success";
    case "error": return "Error";
    case "validation_failed": return "Validation Failed";
    default: return status;
  }
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 select-none">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {badge}
        </div>
      </button>
      {open && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session list card
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  onClick,
}: {
  session: DebugSessionSummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 font-mono">
          {formatTimestamp(session.timestamp)}
        </span>
        <Badge variant={statusBadgeVariant(session.status)}>
          {statusLabel(session.status)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mb-1">
        {session.contract_id && (
          <span className="text-xs bg-forge-100 text-forge-700 px-1.5 py-0.5 rounded font-mono">
            {session.contract_id}
          </span>
        )}
        <span className="text-xs text-gray-500">
          {session.provider}:{session.model}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{formatLatency(session.latency_ms)}</span>
        <span>{formatTokens(session.token_usage.total_tokens)} tokens</span>
        {session.task_id && <span className="font-mono">{session.task_id}</span>}
      </div>
      {session.error && (
        <p className="text-xs text-red-500 mt-1 truncate">{session.error}</p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail tabs
// ---------------------------------------------------------------------------

type DetailTab = "request" | "response" | "metrics";

function RequestTab({ session }: { session: DebugSession }) {
  return (
    <div className="space-y-3">
      {/* Contract + config */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Contract:</span>{" "}
          <span className="font-mono text-gray-700">{session.contract_id ?? "none"}</span>
          {session.contract_name && (
            <span className="text-gray-500 ml-1">({session.contract_name})</span>
          )}
        </div>
        <div>
          <span className="text-gray-400">Provider:</span>{" "}
          <span className="text-gray-700">{session.provider}:{session.model}</span>
        </div>
        <div>
          <span className="text-gray-400">Temperature:</span>{" "}
          <span className="font-mono text-gray-700">{session.temperature}</span>
        </div>
        <div>
          <span className="text-gray-400">Max tokens:</span>{" "}
          <span className="font-mono text-gray-700">{session.max_tokens}</span>
        </div>
        <div>
          <span className="text-gray-400">Response format:</span>{" "}
          <span className="text-gray-700">{session.response_format}</span>
        </div>
      </div>

      {/* System prompt */}
      <CollapsibleSection title="System Prompt" defaultOpen={false}>
        <pre className="text-xs font-mono text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {session.system_prompt || "(empty)"}
        </pre>
      </CollapsibleSection>

      {/* User prompt */}
      <CollapsibleSection title="User Prompt" defaultOpen={false}>
        <pre className="text-xs font-mono text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {session.user_prompt || "(empty)"}
        </pre>
      </CollapsibleSection>

      {/* Context sections */}
      {session.context_sections.length > 0 && (
        <CollapsibleSection
          title="Context Sections"
          badge={
            <span className="text-xs text-gray-400">
              {session.context_sections.length} section{session.context_sections.length !== 1 ? "s" : ""} &middot; {formatTokens(session.total_context_tokens)} tokens
            </span>
          }
        >
          <div className="space-y-2">
            {session.context_sections.map((sec) => (
              <CollapsibleSection
                key={sec.name}
                title={sec.header}
                badge={
                  <span className="flex items-center gap-1">
                    <span className="text-xs font-mono text-gray-400">{formatTokens(sec.token_estimate)} tokens</span>
                    {sec.was_truncated && <Badge variant="warning">truncated</Badge>}
                  </span>
                }
              >
                <pre className="text-xs font-mono text-gray-700 bg-gray-50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {sec.content}
                </pre>
              </CollapsibleSection>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Tools */}
      {session.tools && session.tools.length > 0 && (
        <CollapsibleSection title="Tools" badge={<span className="text-xs text-gray-400">{session.tools.length}</span>}>
          <pre className="text-xs font-mono text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {JSON.stringify(session.tools, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

function ResponseTab({ session }: { session: DebugSession }) {
  return (
    <div className="space-y-3">
      {/* Status + stop reason */}
      <div className="flex items-center gap-3 text-xs">
        <Badge variant={statusBadgeVariant(session.status)}>
          {statusLabel(session.status)}
        </Badge>
        <span className="text-gray-400">
          Stop reason: <span className="text-gray-700">{session.stop_reason}</span>
        </span>
      </div>

      {/* Raw response */}
      <CollapsibleSection title="Raw Response" defaultOpen>
        <pre className="text-xs font-mono text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          {session.raw_response || "(empty)"}
        </pre>
      </CollapsibleSection>

      {/* Parsed output */}
      {session.parsed_output && (
        <CollapsibleSection title="Parsed Output" defaultOpen={false}>
          <pre className="text-xs font-mono text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {JSON.stringify(session.parsed_output, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

function MetricsTab({ session }: { session: DebugSession }) {
  const { token_usage } = session;
  const maxBar = Math.max(token_usage.input_tokens, token_usage.output_tokens, 1);

  return (
    <div className="space-y-4">
      {/* Token usage */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Token Usage</h4>
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Input</span>
              <span className="font-mono text-gray-700">{formatTokens(token_usage.input_tokens)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(token_usage.input_tokens / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Output</span>
              <span className="font-mono text-gray-700">{formatTokens(token_usage.output_tokens)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(token_usage.output_tokens / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t">
            <span className="text-gray-600 font-medium">Total</span>
            <span className="font-mono font-semibold text-gray-800">{formatTokens(token_usage.total_tokens)}</span>
          </div>
        </div>
      </div>

      {/* Latency */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Latency</h4>
        <span className="text-sm font-mono text-gray-800">{formatLatency(session.latency_ms)}</span>
      </div>

      {/* Context token budget */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Context Tokens</h4>
        <span className="text-sm font-mono text-gray-800">{formatTokens(session.total_context_tokens)}</span>
        {session.max_tokens > 0 && (
          <span className="text-xs text-gray-400 ml-2">/ {formatTokens(session.max_tokens)} max</span>
        )}
      </div>

      {/* Validation results */}
      {session.validation_results.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
            Validation Rules
            {!session.validation_passed && (
              <Badge variant="danger" className="ml-2">Failed</Badge>
            )}
            {session.validation_passed && (
              <Badge variant="success" className="ml-2">Passed</Badge>
            )}
          </h4>
          <div className="space-y-1">
            {session.validation_results.map((rule) => (
              <div
                key={rule.rule_id}
                className={`flex items-center justify-between text-xs px-3 py-1.5 rounded ${
                  rule.passed ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={rule.passed ? "text-green-600" : "text-red-600"}>
                    {rule.passed ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-gray-700">{rule.description}</span>
                </div>
                <span className="font-mono text-gray-400">{rule.rule_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error details */}
      {session.error && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Error</h4>
          {session.error_type && (
            <span className="text-xs text-red-600 font-mono">[{session.error_type}] </span>
          )}
          <p className="text-xs text-red-700">{session.error}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------

function SessionDetail({
  session,
  loading,
  onBack,
}: {
  session: DebugSession;
  loading: boolean;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("request");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-400 animate-pulse">Loading session details...</span>
      </div>
    );
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "request", label: "Request" },
    { key: "response", label: "Response" },
    { key: "metrics", label: "Metrics" },
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          &larr; Back
        </button>
        <span className="text-xs font-mono text-gray-500 truncate">{session.session_id}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-forge-600 text-forge-700 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "request" && <RequestTab session={session} />}
      {tab === "response" && <ResponseTab session={session} />}
      {tab === "metrics" && <MetricsTab session={session} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DebugMonitor
// ---------------------------------------------------------------------------

interface DebugMonitorProps {
  slug: string;
  /** If true, render as full page layout instead of overlay panel */
  fullPage?: boolean;
}

export function DebugMonitor({ slug, fullPage = false }: DebugMonitorProps) {
  const {
    sessions,
    total,
    loading,
    error,
    selectedSession,
    loadingDetail,
    fetch: fetchSessions,
    fetchDetail,
    clearSelection,
  } = useDebugSessions(slug);

  const [statusFilter, setStatusFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [clearing, setClearing] = useState(false);

  // F-015: Debounce text filter inputs (300ms)
  const [debouncedTask, setDebouncedTask] = useState("");
  const [debouncedContract, setDebouncedContract] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTask(taskFilter);
      setDebouncedContract(contractFilter);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [taskFilter, contractFilter]);

  // Fetch on mount and when filters change
  const doFetch = useCallback(() => {
    fetchSessions({
      status: statusFilter || undefined,
      task_id: debouncedTask || undefined,
      contract_id: debouncedContract || undefined,
      limit: 50,
    });
  }, [fetchSessions, statusFilter, debouncedTask, debouncedContract]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Auto-refresh every 5 seconds (pauses in detail view or when tab is hidden)
  useEffect(() => {
    if (selectedSession) return; // F-014: skip polling in detail view
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") doFetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [doFetch, selectedSession]);

  const handleClear = useCallback(async () => {
    if (!window.confirm(`Clear all ${total} debug sessions? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await debugApi.clear(slug);
      clearSelection();
      doFetch();
    } catch {
      // Silently handle
    } finally {
      setClearing(false);
    }
  }, [slug, total, clearSelection, doFetch]);

  const handleSessionClick = useCallback(
    (session: DebugSessionSummary) => {
      fetchDetail(session.session_id);
    },
    [fetchDetail],
  );

  const containerClass = fullPage
    ? "h-full max-w-6xl mx-auto"
    : "h-full";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">LLM Debug Monitor</h2>
          <span className="text-xs text-gray-400">{total} session{total !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={doFetch}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClear}
            disabled={clearing || total === 0}
          >
            {clearing ? "Clearing..." : "Clear All"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 mb-4">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Detail view or list view */}
      {selectedSession ? (
        <SessionDetail
          session={selectedSession}
          loading={loadingDetail}
          onBack={clearSelection}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border px-2 py-1 text-xs focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="validation_failed">Validation Failed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Task:</label>
              <input
                type="text"
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
                placeholder="T-001"
                className="rounded-md border px-2 py-1 text-xs w-20 focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Contract:</label>
              <input
                type="text"
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                placeholder="contract-id"
                className="rounded-md border px-2 py-1 text-xs w-28 focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              />
            </div>
          </div>

          {/* Session list */}
          {loading && sessions.length === 0 && (
            <p className="text-sm text-gray-400 animate-pulse py-8 text-center">Loading sessions...</p>
          )}

          {!loading && sessions.length === 0 && (
            <div className="rounded-lg border bg-gray-50 px-4 py-12 text-center">
              <svg
                className="mx-auto h-8 w-8 text-gray-300 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm text-gray-400">
                No debug sessions recorded yet.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Enable the debug monitor and make LLM calls to see sessions here.
              </p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="rounded-lg border bg-white overflow-hidden">
              {sessions.map((s) => (
                <SessionCard
                  key={s.session_id}
                  session={s}
                  onClick={() => handleSessionClick(s)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

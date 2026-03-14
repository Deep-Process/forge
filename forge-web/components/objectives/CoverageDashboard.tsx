"use client";

import { useState, useEffect } from "react";
import { objectives as objectivesApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { useAIElement } from "@/lib/ai-context";

interface KRProgress {
  type: "numeric" | "descriptive";
  metric?: string;
  baseline?: number;
  target?: number;
  current?: number;
  progress_pct?: number;
  description?: string;
  status?: string;
  linked_ideas?: number;
}

interface CoverageObjective {
  id: string;
  title: string;
  status: string;
  key_results: KRProgress[];
  aligned_ideas: number;
  aligned_tasks: number;
  done_tasks: number;
}

interface CoverageDashboardProps {
  slug: string;
}

export function CoverageDashboard({ slug }: CoverageDashboardProps) {
  const [data, setData] = useState<CoverageObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await objectivesApi.status(slug);
        if (!cancelled) setData((res as unknown as { objectives: CoverageObjective[] }).objectives || []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Aggregate metrics for AI
  const totalKRs = data.reduce((s, o) => s + o.key_results.length, 0);
  const coveredKRs = data.reduce(
    (s, o) => s + o.key_results.filter((kr) => (kr.linked_ideas ?? 0) > 0).length,
    0,
  );
  const totalTasks = data.reduce((s, o) => s + o.aligned_tasks, 0);
  const doneTasks = data.reduce((s, o) => s + (o.done_tasks ?? 0), 0);

  useAIElement({
    id: "coverage-dashboard",
    type: "section",
    label: "Objectives Coverage",
    description: `${data.length} objectives, ${coveredKRs}/${totalKRs} KRs covered by ideas, ${doneTasks}/${totalTasks} tasks done`,
    data: {
      objectives: data.length,
      total_krs: totalKRs,
      covered_krs: coveredKRs,
      total_tasks: totalTasks,
      done_tasks: doneTasks,
    },
    actions: [{
      label: "View objective",
      toolName: "getEntity",
      toolParams: ["entity_type=objective", "entity_id*"],
    }],
  });

  if (loading) return <p className="text-sm text-gray-400">Loading coverage data...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (data.length === 0) return <p className="text-sm text-gray-400">No objectives defined yet.</p>;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Planning"
          value={`${coveredKRs}/${totalKRs}`}
          sub="KRs with ideas"
          pct={totalKRs > 0 ? Math.round(coveredKRs / totalKRs * 100) : 0}
        />
        <SummaryCard
          label="Execution"
          value={`${doneTasks}/${totalTasks}`}
          sub="tasks done"
          pct={totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}
        />
        <SummaryCard
          label="Outcome"
          value={`${Math.round(
            data.reduce((s, o) => {
              const nk = o.key_results.filter((kr) => kr.type === "numeric");
              return s + (nk.length > 0 ? nk.reduce((ss, kr) => ss + (kr.progress_pct ?? 0), 0) / nk.length : 0);
            }, 0) / Math.max(data.length, 1),
          )}%`}
          sub="avg KR progress"
          pct={Math.round(
            data.reduce((s, o) => {
              const nk = o.key_results.filter((kr) => kr.type === "numeric");
              return s + (nk.length > 0 ? nk.reduce((ss, kr) => ss + (kr.progress_pct ?? 0), 0) / nk.length : 0);
            }, 0) / Math.max(data.length, 1),
          )}
        />
      </div>

      {/* Per-objective cards */}
      {data.map((obj) => {
        const numericKRs = obj.key_results.filter((kr) => kr.type === "numeric");
        const avgProgress = numericKRs.length > 0
          ? Math.round(numericKRs.reduce((s, kr) => s + (kr.progress_pct ?? 0), 0) / numericKRs.length)
          : 0;
        const uncoveredKRs = obj.key_results.filter((kr) => (kr.linked_ideas ?? 0) === 0);
        const execPct = obj.aligned_tasks > 0 ? Math.round((obj.done_tasks ?? 0) / obj.aligned_tasks * 100) : 0;

        return (
          <div key={obj.id} className="rounded-lg border bg-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{obj.id}</span>
                <Badge variant={statusVariant(obj.status)}>{obj.status}</Badge>
                <h3 className="text-sm font-medium">{obj.title}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{obj.aligned_ideas} ideas</span>
                <span>{obj.done_tasks ?? 0}/{obj.aligned_tasks} tasks</span>
                <span className={`font-semibold ${avgProgress >= 100 ? "text-green-600" : avgProgress >= 50 ? "text-yellow-600" : "text-gray-600"}`}>
                  {avgProgress}% outcome
                </span>
              </div>
            </div>

            {/* Execution progress bar */}
            <div className="mb-3 px-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>Execution: {obj.done_tasks ?? 0}/{obj.aligned_tasks} tasks</span>
                <span>{execPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    execPct >= 100 ? "bg-green-500" : execPct >= 50 ? "bg-blue-500" : "bg-blue-400"
                  }`}
                  style={{ width: `${Math.min(100, execPct)}%` }}
                />
              </div>
            </div>

            {/* Key Results */}
            <div className="space-y-2">
              {obj.key_results.map((kr, i) => {
                const hasIdeas = (kr.linked_ideas ?? 0) > 0;
                if (kr.type === "numeric") {
                  const pct = kr.progress_pct ?? 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-xs rounded px-2 py-1.5 ${
                        !hasIdeas ? "bg-red-50 border border-red-100" : ""
                      }`}
                    >
                      <span className="flex-1 text-gray-700">{kr.metric}</span>
                      <span className="text-[10px] text-gray-400">
                        {kr.linked_ideas ?? 0} idea{(kr.linked_ideas ?? 0) !== 1 ? "s" : ""}
                      </span>
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : pct > 0 ? "bg-blue-500" : "bg-gray-300"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono">
                        {kr.current ?? kr.baseline}/{kr.target}
                      </span>
                      <span className={`w-10 text-right font-semibold ${
                        pct >= 100 ? "text-green-600" : pct === 0 ? "text-red-500" : "text-gray-600"
                      }`}>
                        {pct}%
                      </span>
                      {!hasIdeas && (
                        <span className="text-[10px] text-red-500 font-medium">no ideas</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                    !hasIdeas ? "bg-red-50 border border-red-100" : ""
                  }`}>
                    <span className="flex-1 text-gray-600">{kr.description}</span>
                    <span className="text-[10px] text-gray-400">
                      {kr.linked_ideas ?? 0} idea{(kr.linked_ideas ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <Badge variant={kr.status === "ACHIEVED" ? "success" : "default"}>
                      {kr.status || "NOT_STARTED"}
                    </Badge>
                    {!hasIdeas && (
                      <span className="text-[10px] text-red-500 font-medium">no ideas</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Coverage warnings */}
            {uncoveredKRs.length > 0 && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 rounded text-xs text-red-600">
                {uncoveredKRs.length} KR{uncoveredKRs.length !== 1 ? "s" : ""} without linked ideas — planning gap
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value, sub, pct }: { label: string; value: string; sub: string; pct: number }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
      <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all ${
            pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-gray-400"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

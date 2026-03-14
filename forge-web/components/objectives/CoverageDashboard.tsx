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
}

interface CoverageObjective {
  id: string;
  title: string;
  status: string;
  key_results: KRProgress[];
  aligned_ideas: number;
  aligned_tasks: number;
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
    (s, o) => s + o.key_results.filter((kr) => kr.type === "numeric" && (kr.progress_pct ?? 0) > 0).length,
    0
  );

  useAIElement({
    id: "coverage-dashboard",
    type: "section",
    label: "Objectives Coverage",
    description: `${data.length} objectives, ${coveredKRs}/${totalKRs} KRs with progress`,
    data: {
      objectives: data.length,
      total_krs: totalKRs,
      covered_krs: coveredKRs,
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
      {data.map((obj) => {
        const numericKRs = obj.key_results.filter((kr) => kr.type === "numeric");
        const avgProgress = numericKRs.length > 0
          ? Math.round(numericKRs.reduce((s, kr) => s + (kr.progress_pct ?? 0), 0) / numericKRs.length)
          : 0;
        const uncoveredKRs = numericKRs.filter((kr) => (kr.progress_pct ?? 0) === 0);

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
                <span>{obj.aligned_tasks} tasks</span>
                <span className={`font-semibold ${avgProgress >= 100 ? "text-green-600" : avgProgress >= 50 ? "text-yellow-600" : "text-gray-600"}`}>
                  {avgProgress}% avg
                </span>
              </div>
            </div>

            {/* Key Results */}
            <div className="space-y-2">
              {obj.key_results.map((kr, i) => {
                if (kr.type === "numeric") {
                  const pct = kr.progress_pct ?? 0;
                  const isUncovered = pct === 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-xs ${isUncovered ? "bg-red-50 rounded px-2 py-1.5" : "px-2 py-1"}`}
                    >
                      <span className="flex-1 text-gray-700">{kr.metric}</span>
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
                      {isUncovered && (
                        <span className="text-[10px] text-red-500 font-medium">uncovered</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex items-center gap-2 text-xs px-2 py-1">
                    <span className="text-gray-600">{kr.description}</span>
                    <Badge variant={kr.status === "DONE" ? "success" : "default"}>
                      {kr.status || "NOT_STARTED"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Coverage summary */}
            {uncoveredKRs.length > 0 && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 rounded text-xs text-red-600">
                {uncoveredKRs.length} KR{uncoveredKRs.length !== 1 ? "s" : ""} at 0% — needs attention
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

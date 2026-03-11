"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tasks as tasksApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { ContextView } from "@/components/execution/ContextView";
import type { TaskContext } from "@/lib/types";

export default function TaskContextPage() {
  const { slug, taskId } = useParams() as { slug: string; taskId: string };
  const router = useRouter();
  const [ctx, setCtx] = useState<TaskContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.context(slug, taskId);
      setCtx(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, taskId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-400">Assembling context...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600 mb-4"
        >
          &larr; Back
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600 mb-4"
        >
          &larr; Back
        </button>
        <p className="text-sm text-gray-400">No context available.</p>
      </div>
    );
  }

  const task = ctx.task;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          &larr; Back
        </button>
        <span className="text-xs text-gray-400">{task.id}</span>
        <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
        <Badge>{task.type}</Badge>
      </div>

      <h2 className="text-lg font-semibold mb-1">
        Context Preview: {task.name}
      </h2>

      <div className="flex gap-2 text-xs text-gray-400 mb-6">
        {ctx.scopes.length > 0 && (
          <span>scopes: {ctx.scopes.join(", ")}</span>
        )}
        <span>
          {ctx.sections.length} section{ctx.sections.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchContext}
          className="text-xs text-forge-600 hover:text-forge-700 font-medium"
        >
          Refresh context
        </button>
      </div>

      {/* Context view */}
      <ContextView
        sections={ctx.sections}
        totalTokens={ctx.total_token_estimate}
      />
    </div>
  );
}

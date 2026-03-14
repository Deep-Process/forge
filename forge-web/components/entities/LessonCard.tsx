"use client";

import { useState } from "react";
import Link from "next/link";
import type { Lesson } from "@/lib/types";
import { Badge } from "@/components/shared/Badge";
import { lessons as lessonsApi } from "@/lib/api";

interface LessonCardProps {
  lesson: Lesson;
  slug: string;
  onPromoted?: () => void;
}

const severityVariant = {
  critical: "danger" as const,
  important: "warning" as const,
  minor: "default" as const,
};

export function LessonCard({ lesson, slug, onPromoted }: LessonCardProps) {
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const isPromoted = !!(lesson.promoted_to_guideline || lesson.promoted_to_knowledge);

  const handlePromote = async (target: "guideline" | "knowledge") => {
    setPromoting(target);
    setPromoteError(null);
    try {
      await lessonsApi.promote(slug, lesson.id, { target });
      onPromoted?.();
    } catch (e) {
      setPromoteError((e as Error).message);
    } finally {
      setPromoting(null);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-start justify-between">
        <Link href={`/projects/${slug}/lessons/${lesson.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">{lesson.id}</span>
            <Badge>{lesson.category}</Badge>
            {lesson.severity && (
              <Badge variant={severityVariant[lesson.severity]}>{lesson.severity}</Badge>
            )}
          </div>
          <h3 className="font-medium text-sm">{lesson.title}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lesson.detail}</p>
        </Link>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {!isPromoted && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePromote("guideline"); }}
                disabled={promoting !== null}
                className="text-[10px] font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
              >
                {promoting === "guideline" ? "..." : "→ Guideline"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handlePromote("knowledge"); }}
                disabled={promoting !== null}
                className="text-[10px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {promoting === "knowledge" ? "..." : "→ Knowledge"}
              </button>
            </>
          )}
        </div>
      </div>
      {/* Promotion status */}
      {lesson.promoted_to_guideline && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">
            Promoted → {lesson.promoted_to_guideline}
          </span>
        </div>
      )}
      {lesson.promoted_to_knowledge && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
            Promoted → {lesson.promoted_to_knowledge}
          </span>
        </div>
      )}
      {promoteError && (
        <p className="mt-1 text-[10px] text-red-500">{promoteError}</p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {lesson.task_id && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">task: {lesson.task_id}</span>
        )}
        {lesson.tags.length > 0 && lesson.tags.map((t) => (
          <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>
    </div>
  );
}

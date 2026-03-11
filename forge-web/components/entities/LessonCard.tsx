import type { Lesson } from "@/lib/types";
import { Badge } from "@/components/shared/Badge";

interface LessonCardProps {
  lesson: Lesson;
}

const severityVariant = {
  critical: "danger" as const,
  important: "warning" as const,
  minor: "default" as const,
};

export function LessonCard({ lesson }: LessonCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{lesson.id}</span>
        <Badge>{lesson.category}</Badge>
        {lesson.severity && (
          <Badge variant={severityVariant[lesson.severity]}>{lesson.severity}</Badge>
        )}
      </div>
      <h3 className="font-medium text-sm">{lesson.title}</h3>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lesson.detail}</p>
      {lesson.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lesson.tags.map((t) => (
            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

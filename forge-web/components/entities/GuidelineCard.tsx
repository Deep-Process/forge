import Link from "next/link";
import type { Guideline } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface GuidelineCardProps {
  guideline: Guideline;
  slug: string;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

const weightVariant = {
  must: "danger" as const,
  should: "warning" as const,
  may: "default" as const,
};

export function GuidelineCard({ guideline, slug, selected, onSelect }: GuidelineCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            onChange={() => {}}
            className="mt-1 shrink-0 rounded border-gray-300 text-forge-600 focus:ring-forge-500"
          />
        )}
        <div className="flex-1 min-w-0">
          <Link href={`/projects/${slug}/guidelines/${guideline.id}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">{guideline.id}</span>
              <Badge variant={statusVariant(guideline.status)}>{guideline.status}</Badge>
              <Badge variant={weightVariant[guideline.weight]}>{guideline.weight.toUpperCase()}</Badge>
            </div>
            <h3 className="font-medium text-sm">{guideline.title}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{guideline.content}</p>
          </Link>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
            <span>scope: {guideline.scope}</span>
            {guideline.tags.length > 0 && (
              <span>tags: {guideline.tags.join(", ")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

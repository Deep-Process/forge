import Link from "next/link";
import type { Research } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface ResearchCardProps {
  research: Research;
  slug: string;
  onEdit?: (research: Research) => void;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  architecture: "info",
  domain: "default",
  feasibility: "warning",
  risk: "danger",
  business: "success",
  technical: "default",
};

export function ResearchCard({ research: r, slug, onEdit, selected, onSelect }: ResearchCardProps) {
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
      <div className="flex items-start justify-between mb-1">
        <Link
          href={`/projects/${slug}/research/${r.id}`}
          className="flex items-center gap-2 flex-wrap"
        >
          <span className="text-xs text-gray-400">{r.id}</span>
          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
          <Badge variant={(CATEGORY_COLORS[r.category] ?? "default") as "default" | "info" | "warning" | "danger" | "success"}>
            {r.category}
          </Badge>
          {r.skill && (
            <span className="text-[10px] text-gray-400">{r.skill}</span>
          )}
        </Link>
        {onEdit && (
          <button
            onClick={() => onEdit(r)}
            className="text-xs text-gray-400 hover:text-forge-600"
          >
            Edit
          </button>
        )}
      </div>
      <Link href={`/projects/${slug}/research/${r.id}`}>
        <h3 className="font-medium text-sm">{r.title}</h3>
        {r.summary && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.summary}</p>
        )}
      </Link>
      {/* Linked entity */}
      {r.linked_entity_id && (
        <div className="mt-2 text-[10px] text-gray-400">
          Linked to: {r.linked_entity_type} {r.linked_entity_id}
        </div>
      )}
      {/* Key findings preview */}
      {r.key_findings.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {r.key_findings.length} finding{r.key_findings.length > 1 ? "s" : ""}
          {r.decision_ids.length > 0 && (
            <span className="ml-2">
              | {r.decision_ids.length} decision{r.decision_ids.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
      {/* Tags */}
      {r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

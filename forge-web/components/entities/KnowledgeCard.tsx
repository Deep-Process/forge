import type { Knowledge } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";
import Link from "next/link";

interface KnowledgeCardProps {
  knowledge: Knowledge;
  slug: string;
}

export function KnowledgeCard({ knowledge: k, slug }: KnowledgeCardProps) {
  return (
    <Link
      href={`/projects/${slug}/knowledge/${k.id}`}
      className="block rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{k.id}</span>
        <Badge variant={statusVariant(k.status)}>{k.status}</Badge>
        <Badge>{k.category}</Badge>
      </div>
      <h3 className="font-medium text-sm">{k.title}</h3>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{k.content}</p>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
        {k.scopes.length > 0 && <span>scopes: {k.scopes.join(", ")}</span>}
        {k.linked_entities.length > 0 && (
          <span>{k.linked_entities.length} link{k.linked_entities.length !== 1 ? "s" : ""}</span>
        )}
        {k.dependencies.length > 0 && (
          <span>{k.dependencies.length} dep{k.dependencies.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {k.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {k.tags.map((t) => (
            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

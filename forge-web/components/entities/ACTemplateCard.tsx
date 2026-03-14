import Link from "next/link";
import type { ACTemplate } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface ACTemplateCardProps {
  template: ACTemplate;
  slug: string;
  onInstantiate?: (templateId: string) => void;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

const categoryVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  performance: "warning",
  security: "danger",
  quality: "info",
  functionality: "success",
  accessibility: "info",
  reliability: "warning",
  "data-integrity": "danger",
  ux: "success",
};

export function ACTemplateCard({ template, slug, onInstantiate, selected, onSelect }: ACTemplateCardProps) {
  // Preview: show template with placeholders highlighted
  const renderTemplatePreview = (tmpl: string) => {
    const parts = tmpl.split(/(\{[^}]+\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{[^}]+\}$/)) {
        return (
          <span key={i} className="inline-flex items-center rounded bg-forge-100 text-forge-700 px-1 text-xs font-mono">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors group">
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
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/projects/${slug}/ac-templates/${template.id}`} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{template.id}</span>
              <Badge variant={statusVariant(template.status)}>{template.status}</Badge>
              <Badge variant={categoryVariant[template.category] ?? "default"}>{template.category}</Badge>
            </Link>
            {template.usage_count != null && template.usage_count > 0 && (
              <span className="text-[10px] text-gray-400">used {template.usage_count}x</span>
            )}
            {onInstantiate && template.status === "ACTIVE" && (
              <button
                onClick={(e) => { e.stopPropagation(); onInstantiate(template.id); }}
                className="ml-auto text-xs text-forge-600 hover:text-forge-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Instantiate
              </button>
            )}
          </div>
          <Link href={`/projects/${slug}/ac-templates/${template.id}`}>
            <h3 className="font-medium text-sm">{template.title}</h3>
            {template.description && (
              <p className="text-xs text-gray-500 mt-1">{template.description}</p>
            )}
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono">
              {renderTemplatePreview(template.template)}
            </div>
          </Link>
          {template.parameters && template.parameters.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-gray-400">Parameters: </span>
              {template.parameters.map((p) => (
                <span key={p.name} className="inline-flex items-center text-[10px] bg-forge-50 text-forge-600 px-1.5 py-0.5 rounded mr-1">
                  {p.name}
                  {p.type && <span className="ml-0.5 text-gray-400">:{p.type}</span>}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
            {template.scopes.length > 0 && (
              <span>scopes: {template.scopes.join(", ")}</span>
            )}
            {template.tags.length > 0 && (
              <span>tags: {template.tags.join(", ")}</span>
            )}
            {template.verification_method && (
              <span>verify: {template.verification_method}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

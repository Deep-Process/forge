import type { Skill } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";
import Link from "next/link";

interface SkillCardProps {
  skill: Skill;
  onEdit?: (skill: Skill) => void;
  view?: "list" | "grid";
}

const categoryLabels: Record<string, string> = {
  workflow: "Workflow",
  analysis: "Analysis",
  generation: "Generation",
  validation: "Validation",
  integration: "Integration",
  refactoring: "Refactoring",
  testing: "Testing",
  deployment: "Deployment",
  documentation: "Documentation",
  custom: "Custom",
};

export function SkillCard({ skill: s, onEdit, view = "list" }: SkillCardProps) {
  const isGrid = view === "grid";

  return (
    <div
      className={`rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors ${
        s.promoted_with_warnings ? "border-l-4 border-l-amber-400" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <Link
          href={`/skills/${s.id}`}
          className="flex items-center gap-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-forge-500 rounded"
        >
          <span className="text-xs text-gray-400">{s.id}</span>
          <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
          <Badge>{categoryLabels[s.category] ?? s.category}</Badge>
          {s.promoted_with_warnings && (
            <Badge variant="warning">Warnings</Badge>
          )}
        </Link>
        {onEdit && (
          <button
            onClick={() => onEdit(s)}
            className="text-xs text-gray-400 hover:text-forge-600"
          >
            Edit
          </button>
        )}
      </div>
      <h3 className="font-medium text-sm">{s.name}</h3>
      {s.description && (
        <p className={`text-xs text-gray-500 mt-1 ${isGrid ? "line-clamp-2" : "line-clamp-3"}`}>
          {s.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
        {s.evals_json.length > 0 && (
          <span>{s.evals_json.length} eval{s.evals_json.length !== 1 ? "s" : ""}</span>
        )}
        {s.usage_count > 0 && (
          <span>used {s.usage_count}x</span>
        )}
        {s.scopes.length > 0 && <span>scopes: {s.scopes.join(", ")}</span>}
      </div>
      {s.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {s.tags.map((t) => (
            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

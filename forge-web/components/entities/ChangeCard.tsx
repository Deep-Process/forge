import type { ChangeRecord } from "@/lib/types";
import { Badge } from "@/components/shared/Badge";

interface ChangeCardProps {
  change: ChangeRecord;
}

const actionColors: Record<string, string> = {
  create: "success",
  edit: "info",
  delete: "danger",
  rename: "warning",
  move: "warning",
  verify: "default",
} as const;

export function ChangeCard({ change }: ChangeCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{change.id}</span>
        <Badge variant={(actionColors[change.action] ?? "default") as "success" | "info" | "danger" | "warning" | "default"}>
          {change.action}
        </Badge>
        <span className="text-xs text-gray-400">{change.task_id}</span>
      </div>
      <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded text-gray-700">{change.file}</code>
      <p className="text-xs text-gray-500 mt-1">{change.summary}</p>
      {(change.lines_added || change.lines_removed) && (
        <div className="flex gap-2 mt-1 text-[10px]">
          {change.lines_added ? <span className="text-green-600">+{change.lines_added}</span> : null}
          {change.lines_removed ? <span className="text-red-600">-{change.lines_removed}</span> : null}
        </div>
      )}
    </div>
  );
}

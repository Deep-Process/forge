import type { Task } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface TaskCardProps {
  task: Task;
  onStatusChange?: (id: string, status: string) => void;
}

export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">{task.id}</span>
            <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
            <Badge>{task.type}</Badge>
          </div>
          <h3 className="font-medium text-sm">{task.name}</h3>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        {onStatusChange && task.status === "TODO" && (
          <button
            onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
            className="text-xs text-forge-600 hover:text-forge-700 font-medium ml-2"
          >
            Start
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {task.scopes.map((s) => (
          <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{s}</span>
        ))}
        {task.depends_on.length > 0 && (
          <span className="text-[10px] text-gray-400">depends: {task.depends_on.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

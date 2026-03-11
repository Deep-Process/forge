import type { Decision } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface DecisionCardProps {
  decision: Decision;
  onClose?: (id: string) => void;
}

export function DecisionCard({ decision, onClose }: DecisionCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">{decision.id}</span>
            <Badge variant={statusVariant(decision.status)}>{decision.status}</Badge>
            <Badge>{decision.type}</Badge>
            <Badge variant={decision.confidence === "HIGH" ? "success" : decision.confidence === "LOW" ? "danger" : "warning"}>
              {decision.confidence}
            </Badge>
          </div>
          <h3 className="font-medium text-sm">{decision.issue}</h3>
          <p className="text-xs text-gray-500 mt-1">{decision.recommendation}</p>
        </div>
        {onClose && !["CLOSED", "MITIGATED", "ACCEPTED"].includes(decision.status) && (
          <button
            onClick={() => onClose(decision.id)}
            className="text-xs text-forge-600 hover:text-forge-700 font-medium ml-2"
          >
            Close
          </button>
        )}
      </div>
      {decision.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {decision.tags.map((t) => (
            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

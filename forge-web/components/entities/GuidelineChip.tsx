import type { GuidelineWeight } from "@/lib/types";

interface GuidelineChipProps {
  id: string;
  scope: string;
  weight: GuidelineWeight;
  title: string;
}

const weightColors: Record<GuidelineWeight, string> = {
  must: "bg-red-50 text-red-700 border-red-200",
  should: "bg-yellow-50 text-yellow-700 border-yellow-200",
  may: "bg-gray-50 text-gray-600 border-gray-200",
};

const weightDot: Record<GuidelineWeight, string> = {
  must: "bg-red-500",
  should: "bg-yellow-500",
  may: "bg-gray-400",
};

/**
 * Compact guideline display chip showing scope, weight indicator, and abbreviated title.
 * Designed for embedding in task cards, idea cards, and other entity views.
 */
export function GuidelineChip({ id, scope, weight, title }: GuidelineChipProps) {
  const abbreviated = title.length > 40 ? title.slice(0, 37) + "..." : title;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${weightColors[weight]}`}
      title={`${id}: [${weight.toUpperCase()}] ${scope} — ${title}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${weightDot[weight]}`} />
      <span className="text-[10px] opacity-70">{scope}</span>
      <span className="mx-0.5 opacity-30">|</span>
      <span>{abbreviated}</span>
    </span>
  );
}

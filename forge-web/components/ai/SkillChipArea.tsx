"use client";

import { useAIElement } from "@/lib/ai-context";
import type { AttachedSkillInfo } from "@/stores/sidebarStore";

interface SkillChipAreaProps {
  skills: AttachedSkillInfo[];
  onRemove: (name: string) => void;
}

export function SkillChipArea({ skills, onRemove }: SkillChipAreaProps) {
  useAIElement({
    id: "skill-chips",
    type: "display",
    label: "Attached Skills",
    value: skills.map((s) => s.display_name).join(", "),
  });

  if (skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2">
      {skills.map((skill) => (
        <span
          key={skill.name}
          className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-sm text-white"
        >
          {skill.display_name}
          <button
            type="button"
            onClick={() => onRemove(skill.name)}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-600 focus:outline-none"
            aria-label={`Remove ${skill.display_name}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

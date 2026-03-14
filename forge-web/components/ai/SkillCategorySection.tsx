"use client";

import { useState } from "react";
import type { Skill } from "@/lib/types";

interface SkillCategorySectionProps {
  category: string;
  skills: Skill[];
  attachedSkillNames: Set<string>;
  onAttachSkill: (name: string, display_name: string) => void;
}

export function SkillCategorySection({
  category,
  skills,
  attachedSkillNames,
  onAttachSkill,
}: SkillCategorySectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50"
      >
        <span className="text-[10px] text-gray-400 shrink-0 select-none w-3 text-center">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="truncate">{category}</span>
        <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
          {skills.length}
        </span>
      </button>

      {expanded && (
        <div className="pb-1">
          {skills.map((skill) => {
            const isAttached = attachedSkillNames.has(skill.name);
            const displayName = skill.display_name || skill.name;

            return (
              <div
                key={skill.name}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-gray-800">
                    {displayName}
                  </div>
                  {skill.description && (
                    <div className="truncate text-[11px] text-gray-500">
                      {skill.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => !isAttached && onAttachSkill(skill.name, displayName)}
                  disabled={isAttached}
                  className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    isAttached
                      ? "cursor-default text-green-600"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                  aria-label={isAttached ? `${displayName} attached` : `Attach ${displayName}`}
                >
                  {isAttached ? "\u2713" : "Attach"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { skills as skillsApi } from "@/lib/api";
import type { Skill } from "@/lib/types";

interface SkillPickerProps {
  /** Skill names to choose from. */
  skillNames: string[];
}

/**
 * Inline picker shown below the entity badge when an entity type has
 * 2+ skills assigned. User picks one, or clicks "AI choose" to let
 * the LLM decide on the first message.
 */
export function SkillPicker({ skillNames }: SkillPickerProps) {
  const attachSkill = useSidebarStore((s) => s.attachSkill);
  const setPendingSkillPick = useSidebarStore((s) => s.setPendingSkillPick);
  const setAiChooseSkill = useSidebarStore((s) => s.setAiChooseSkill);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    skillsApi.list().then(({ skills: all }) => {
      if (cancelled) return;
      setSkills(all.filter((s) => skillNames.includes(s.name)));
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [skillNames]);

  const handlePick = (skill: Skill) => {
    attachSkill(skill.name, skill.display_name || skill.name);
    setPendingSkillPick(null);
  };

  const handleAiChoose = () => {
    // Attach all candidate skills — LLM will use the most relevant one
    for (const skill of skills) {
      attachSkill(skill.name, skill.display_name || skill.name);
    }
    setAiChooseSkill(true);
    setPendingSkillPick(null);
  };

  const handleDismiss = () => {
    setPendingSkillPick(null);
  };

  if (loading) {
    return (
      <div className="px-3 py-2 border-b bg-amber-50 text-xs text-amber-600">
        Loading skills...
      </div>
    );
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-2 border-b bg-amber-50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-amber-800">
          Choose a skill for this entity
        </span>
        <button
          onClick={handleDismiss}
          className="text-[10px] text-amber-500 hover:text-amber-700"
          title="Dismiss — use plain chat"
        >
          Skip
        </button>
      </div>
      <div className="space-y-1">
        {skills.map((skill) => (
          <button
            key={skill.name}
            onClick={() => handlePick(skill)}
            className="w-full text-left rounded border border-amber-200 bg-white px-2.5 py-1.5 hover:border-amber-400 hover:bg-amber-50 transition-colors"
          >
            <div className="text-xs font-medium text-gray-800">
              {skill.display_name || skill.name}
            </div>
            {skill.description && (
              <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                {skill.description}
              </div>
            )}
          </button>
        ))}
        <button
          onClick={handleAiChoose}
          className="w-full text-left rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 hover:border-indigo-400 hover:bg-indigo-100 transition-colors"
        >
          <div className="text-xs font-medium text-indigo-700">
            AI choose
          </div>
          <div className="text-[10px] text-indigo-500 mt-0.5">
            Let the AI pick the best skill based on your message
          </div>
        </button>
      </div>
    </div>
  );
}

"use client";

import { SkillEditor } from "@/components/skills/SkillEditor";
import { useAIPage } from "@/lib/ai-context";

export default function NewSkillPage() {
  useAIPage({
    id: "new-skill",
    title: "New Skill",
    description: "Create a new skill",
    route: "/skills/new",
  });

  return (
    <div className="h-full">
      <SkillEditor />
    </div>
  );
}

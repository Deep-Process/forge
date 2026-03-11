import { useMemo } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useDecisionStore } from "@/stores/decisionStore";
import { useObjectiveStore } from "@/stores/objectiveStore";
import { useIdeaStore } from "@/stores/ideaStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { useGuidelineStore } from "@/stores/guidelineStore";
import { useLessonStore } from "@/stores/lessonStore";
import type { Task, Decision, Objective, Idea, Knowledge, Guideline, Lesson } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  type: "task" | "decision" | "objective" | "idea" | "knowledge" | "guideline" | "lesson";
  id: string;
  title: string;
  status: string;
  icon: string;
  href: string;
}

export interface QuickAction {
  id: string;
  label: string;
  shortcut?: string;
  action: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-task", label: "New Task", action: "new-task" },
  { id: "new-idea", label: "New Idea", action: "new-idea" },
  { id: "new-decision", label: "New Decision", action: "new-decision" },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCommandPaletteSearch(slug: string, query: string) {
  const tasks = useTaskStore((s) => s.items) as Task[];
  const decisions = useDecisionStore((s) => s.items) as Decision[];
  const objectives = useObjectiveStore((s) => s.items) as Objective[];
  const ideas = useIdeaStore((s) => s.items) as Idea[];
  const knowledge = useKnowledgeStore((s) => s.items) as Knowledge[];
  const guidelines = useGuidelineStore((s) => s.items) as Guideline[];
  const lessons = useLessonStore((s) => s.items) as Lesson[];

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    const matches: Array<SearchResult & { score: number }> = [];

    const allEntities: Array<{
      type: SearchResult["type"];
      icon: string;
      segment: string;
      items: Array<{ id: string; name?: string; title?: string; status: string }>;
    }> = [
      { type: "task", icon: "☑", segment: "tasks", items: tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })) },
      { type: "decision", icon: "⚖", segment: "decisions", items: decisions.map((d) => ({ id: d.id, title: d.issue, status: d.status })) },
      { type: "objective", icon: "◎", segment: "objectives", items: objectives.map((o) => ({ id: o.id, title: o.title, status: o.status })) },
      { type: "idea", icon: "💡", segment: "ideas", items: ideas.map((i) => ({ id: i.id, title: i.title, status: i.status })) },
      { type: "knowledge", icon: "📚", segment: "knowledge", items: knowledge.map((k) => ({ id: k.id, title: k.title, status: k.status })) },
      { type: "guideline", icon: "📏", segment: "guidelines", items: guidelines.map((g) => ({ id: g.id, title: g.title, status: g.status })) },
      { type: "lesson", icon: "🎓", segment: "lessons", items: lessons.map((l) => ({ id: l.id, title: l.title, status: l.severity ?? "minor" })) },
    ];

    for (const entity of allEntities) {
      for (const item of entity.items) {
        const title = item.name || item.title || "";
        const idLower = item.id.toLowerCase();
        const titleLower = title.toLowerCase();

        let score = 0;

        // Exact ID match → highest score
        if (idLower === q) {
          score = 100;
        } else if (idLower.startsWith(q)) {
          score = 80;
        } else if (idLower.includes(q)) {
          score = 60;
        } else if (titleLower.includes(q)) {
          score = 40;
        }

        if (score > 0) {
          matches.push({
            type: entity.type,
            id: item.id,
            title,
            status: item.status,
            icon: entity.icon,
            href: `/projects/${slug}/${entity.segment}/${item.id}`,
            score,
          });
        }
      }
    }

    // Sort by score descending, then by ID
    matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    return matches.slice(0, 20);
  }, [query, slug, tasks, decisions, objectives, ideas, knowledge, guidelines, lessons]);

  return { results, quickActions: QUICK_ACTIONS };
}

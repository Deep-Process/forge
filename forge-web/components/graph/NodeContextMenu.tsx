"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebarStore";

/** Map entity type to URL route segment. */
const TYPE_TO_ROUTE: Record<string, string> = {
  objective: "objectives",
  idea: "ideas",
  task: "tasks",
  decision: "decisions",
  research: "research",
  knowledge: "knowledge",
  guideline: "guidelines",
  lesson: "lessons",
  ac_template: "ac-templates",
};

interface NodeContextMenuProps {
  x: number;
  y: number;
  entityType: string;
  entityId: string;
  label: string;
  slug: string;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  entityType,
  entityId,
  label,
  slug,
  onClose,
}: NodeContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleEdit = useCallback(() => {
    const route = TYPE_TO_ROUTE[entityType];
    if (route) {
      // Mark that we came from DAG so detail page can show "Back to DAG"
      try { sessionStorage.setItem("forge-from-dag", slug); } catch {}
      router.push(`/projects/${slug}/${route}/${entityId}`);
    }
    onClose();
  }, [entityType, entityId, slug, router, onClose]);

  const handleAI = useCallback(() => {
    useSidebarStore.getState().setTargetEntity({
      type: entityType,
      id: entityId,
      label: label || entityId,
    });
    useSidebarStore.getState().setActiveTab("chat");
    onClose();
  }, [entityType, entityId, label, onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 50,
        minWidth: 160,
      }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-xs"
    >
      <div className="px-3 py-1.5 text-[10px] text-gray-400 font-mono border-b">
        {entityType}:{entityId}
      </div>
      <button
        onClick={handleEdit}
        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
      <button
        onClick={handleAI}
        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        AI Assistant
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useLeftPanelContent } from "./LeftPanelProvider";

const STORAGE_KEY = "forge-left-panel-collapsed";

export function LeftPanel() {
  const content = useLeftPanelContent();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  if (!content) return null;

  if (collapsed) {
    return (
      <aside
        onClick={toggleCollapsed}
        className="flex-shrink-0 w-6 border-r bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        title="Expand panel"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCollapsed(); }}
      >
        <span className="text-xs">{"\u25B6"}</span>
      </aside>
    );
  }

  return (
    <aside className="flex-shrink-0 border-r bg-white flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">{content}</div>
      <button
        onClick={toggleCollapsed}
        className="w-5 flex-shrink-0 flex items-center justify-center border-l bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="Collapse panel"
      >
        <span className="text-xs">{"\u25C0"}</span>
      </button>
    </aside>
  );
}

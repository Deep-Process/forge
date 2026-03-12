"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

const STORAGE_KEY_COLLAPSED = "forge-right-sidebar-collapsed";
const STORAGE_KEY_WIDTH = "forge-right-sidebar-width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 420;

export function RightSidebarSlot({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const storedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (storedCollapsed !== null) setCollapsed(storedCollapsed === "true");
    const storedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (storedWidth !== null) {
      const w = parseInt(storedWidth, 10);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setWidth(w);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      return next;
    });
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      setDragging(true);
      document.body.style.userSelect = "none";
    },
    [width]
  );

  useEffect(() => {
    if (!dragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setWidth(newWidth);
    };

    const onPointerUp = () => {
      setDragging(false);
      document.body.style.userSelect = "";
      setWidth((w) => {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(w));
        return w;
      });
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging]);

  if (collapsed) {
    return (
      <div
        onClick={toggleCollapsed}
        className="flex-shrink-0 w-10 border-l bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        title="Open AI Sidebar"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCollapsed(); }}
      >
        <span className="text-sm">{"\u25C0"}</span>
        <span className="text-[10px] mt-1 writing-mode-vertical" style={{ writingMode: "vertical-rl" }}>AI</span>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-l bg-white flex"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-forge-400 transition-colors ${
          dragging ? "bg-forge-400" : "bg-transparent"
        }`}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with collapse button */}
        <div className="h-10 flex items-center justify-between px-3 border-b flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">AI Assistant</span>
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Collapse sidebar"
          >
            <span className="text-xs">{"\u25B6"}</span>
          </button>
        </div>

        {/* Content area — O-014 will populate */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

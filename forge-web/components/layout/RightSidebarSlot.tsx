"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

const STORAGE_KEY_COLLAPSED = "forge-right-sidebar-collapsed";
const STORAGE_KEY_WIDTH = "forge-right-sidebar-width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 420;

export function RightSidebarSlot({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="h-10 flex items-center justify-between px-4 border-b flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">AI Assistant</span>
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-xs"
            title="Exit fullscreen"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
            Exit fullscreen
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFullscreen(true)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Fullscreen"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={toggleCollapsed}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Collapse sidebar"
            >
              <span className="text-xs">{"\u25B6"}</span>
            </button>
          </div>
        </div>

        {/* Content area — O-014 will populate */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

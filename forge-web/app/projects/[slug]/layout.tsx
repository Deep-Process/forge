"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/stores/projectStore";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { dispatchWsEvent } from "@/stores/wsDispatcher";
import { DebugToggle } from "@/components/debug/DebugToggle";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BottomPanel } from "@/components/debug/BottomPanel";
import { useDebugPanelStore } from "@/stores/debugPanelStore";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { details, selectProject } = useProjectStore();
  const detail = details[slug];
  const { connected, onAny } = useWebSocket(slug);
  const incrementEvents = useDebugPanelStore((s) => s.incrementEvents);

  useEffect(() => {
    if (slug) selectProject(slug);
  }, [slug, selectProject]);

  // Forward all WebSocket events to per-entity stores + count events
  useEffect(() => {
    const unsub = onAny((event) => {
      dispatchWsEvent(event);
      incrementEvents();
    });
    return unsub;
  }, [onAny, incrementEvents]);

  return (
    <div className="flex h-full -m-6">
      {/* Project sidebar */}
      <ProjectSidebar slug={slug} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Project header bar */}
        <div className="flex-shrink-0 px-6 pt-4 pb-2 border-b bg-white">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/projects" className="text-gray-400 hover:text-gray-600">
              Projects
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-700 font-medium">{slug}</span>
            {detail && (
              <span className="text-gray-400 ml-2 truncate hidden sm:inline">
                — {detail.goal}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <DebugToggle slug={slug} />
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
                title={connected ? "WebSocket connected" : "WebSocket disconnected"}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Breadcrumb />
          {children}
        </div>

        {/* Debug bottom panel */}
        <BottomPanel />
      </div>
    </div>
  );
}

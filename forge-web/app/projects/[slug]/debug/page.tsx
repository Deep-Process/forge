"use client";

import { useParams } from "next/navigation";
import { DebugMonitor } from "@/components/debug/DebugMonitor";
import { useAIPage } from "@/lib/ai-context";

export default function DebugPage() {
  const { slug } = useParams() as { slug: string };

  useAIPage({
    id: "debug",
    title: "Debug Monitor",
    description: `WebSocket and event debug monitor for ${slug}`,
    route: `/projects/${slug}/debug`,
  });

  return <DebugMonitor slug={slug} fullPage />;
}

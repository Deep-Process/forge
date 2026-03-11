"use client";

import { useParams } from "next/navigation";
import { DebugMonitor } from "@/components/debug/DebugMonitor";

export default function DebugPage() {
  const { slug } = useParams() as { slug: string };

  return <DebugMonitor slug={slug} fullPage />;
}

"use client";

import { useParams } from "next/navigation";
import { ActiveTasksDashboard } from "@/components/execution/ActiveTasksDashboard";

export default function ExecutionIndexPage() {
  const { slug } = useParams() as { slug: string };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Execution</h2>
      <ActiveTasksDashboard slug={slug} />
    </div>
  );
}

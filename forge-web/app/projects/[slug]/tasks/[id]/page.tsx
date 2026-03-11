"use client";

import { useParams } from "next/navigation";

export default function TaskDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Task {id}</h1>
      <p className="text-gray-500">
        Task detail page for <span className="font-mono">{id}</span> in project{" "}
        <span className="font-mono">{slug}</span>. Full implementation in T-060.
      </p>
    </div>
  );
}

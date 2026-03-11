"use client";

import { useParams } from "next/navigation";

export default function ObjectiveDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Objective {id}</h1>
      <p className="text-gray-500">
        Objective detail page for <span className="font-mono">{id}</span> in project{" "}
        <span className="font-mono">{slug}</span>. Full implementation in T-061.
      </p>
    </div>
  );
}

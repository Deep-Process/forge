"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { skills as skillsApi } from "@/lib/api";
import { SkillEditor } from "@/components/skills/SkillEditor";
import type { Skill } from "@/lib/types";

export default function SkillDetailPage() {
  const { id } = useParams() as { id: string };
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skillsApi.get(id);
      setSkill(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  if (loading) return <p className="text-sm text-gray-400 p-4">Loading...</p>;
  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;
  if (!skill) return <p className="text-sm text-gray-400 p-4">Not found</p>;

  return (
    <div className="h-full">
      <SkillEditor skill={skill} onSaved={fetchSkill} />
    </div>
  );
}

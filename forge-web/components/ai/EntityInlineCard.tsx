"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, statusVariant } from "@/components/shared/Badge";
import {
  tasks as tasksApi,
  decisions as decisionsApi,
  objectives as objectivesApi,
  ideas as ideasApi,
  knowledge as knowledgeApi,
  guidelines as guidelinesApi,
  lessons as lessonsApi,
  research as researchApi,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Entity type config
// ---------------------------------------------------------------------------

const ENTITY_MAP: Record<string, { type: string; route: string; bg: string; text: string }> = {
  T:  { type: "task",       route: "tasks",       bg: "bg-blue-50",    text: "text-blue-700" },
  D:  { type: "decision",   route: "decisions",   bg: "bg-purple-50",  text: "text-purple-700" },
  K:  { type: "knowledge",  route: "knowledge",   bg: "bg-teal-50",    text: "text-teal-700" },
  O:  { type: "objective",  route: "objectives",  bg: "bg-amber-50",   text: "text-amber-700" },
  I:  { type: "idea",       route: "ideas",       bg: "bg-green-50",   text: "text-green-700" },
  G:  { type: "guideline",  route: "guidelines",  bg: "bg-gray-100",   text: "text-gray-700" },
  L:  { type: "lesson",     route: "lessons",     bg: "bg-rose-50",    text: "text-rose-700" },
  R:  { type: "research",   route: "research",    bg: "bg-indigo-50",  text: "text-indigo-700" },
  AC: { type: "ac_template", route: "ac-templates", bg: "bg-cyan-50",  text: "text-cyan-700" },
};

function parsePrefix(id: string) {
  if (id.startsWith("AC-")) return ENTITY_MAP.AC;
  const prefix = id.split("-")[0];
  return ENTITY_MAP[prefix] || null;
}

// ---------------------------------------------------------------------------
// Shared preview cache (reuses EntityLink's cache shape)
// ---------------------------------------------------------------------------

interface PreviewData {
  title: string;
  status?: string;
}

const MAX_CACHE = 200;
const cache = new Map<string, PreviewData>();

async function fetchPreview(slug: string, entityId: string): Promise<PreviewData | null> {
  const key = `${slug}/${entityId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const info = parsePrefix(entityId);
  if (!info) return null;

  try {
    let data: PreviewData | null = null;
    switch (info.type) {
      case "task":        { const e = await tasksApi.get(slug, entityId);       data = { title: e.name, status: e.status }; break; }
      case "decision":    { const e = await decisionsApi.get(slug, entityId);   data = { title: e.issue, status: e.status }; break; }
      case "objective":   { const e = await objectivesApi.get(slug, entityId);  data = { title: e.title, status: e.status }; break; }
      case "idea":        { const e = await ideasApi.get(slug, entityId);       data = { title: e.title, status: e.status }; break; }
      case "knowledge":   { const e = await knowledgeApi.get(slug, entityId);   data = { title: e.title, status: e.status }; break; }
      case "guideline":   { const e = await guidelinesApi.get(slug, entityId);  data = { title: e.title, status: e.status }; break; }
      case "lesson":      { const e = await lessonsApi.get(slug, entityId);     data = { title: e.title }; break; }
      case "research":    { const e = await researchApi.get(slug, entityId);    data = { title: e.title, status: e.status }; break; }
    }
    if (data) {
      if (cache.size >= MAX_CACHE) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(key, data);
    }
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  entityId: string;
  projectSlug: string;
}

export default function EntityInlineCard({ entityId, projectSlug }: Props) {
  const info = parsePrefix(entityId);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!projectSlug || !info) return;
    let cancelled = false;
    fetchPreview(projectSlug, entityId).then((d) => {
      if (!cancelled) setPreview(d);
    });
    return () => { cancelled = true; };
  }, [projectSlug, entityId, info]);

  if (!info) {
    return <code className="text-xs">{entityId}</code>;
  }

  const href = `/projects/${projectSlug}/${info.route}/${entityId}`;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium
        ${info.bg} ${info.text} border-current/20 hover:brightness-95 transition-colors no-underline`}
    >
      <span className="font-mono font-semibold">{entityId}</span>
      {preview?.title && (
        <span className="max-w-[160px] truncate font-normal opacity-80">{preview.title}</span>
      )}
      {preview?.status && (
        <Badge variant={statusVariant(preview.status)} className="ml-0.5 text-[9px] py-0">
          {preview.status}
        </Badge>
      )}
    </Link>
  );
}

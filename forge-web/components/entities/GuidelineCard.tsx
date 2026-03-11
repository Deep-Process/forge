"use client";

import { useState } from "react";
import type { Guideline, GuidelineUpdate, GuidelineWeight } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface GuidelineCardProps {
  guideline: Guideline;
  editing?: boolean;
  onEditToggle?: () => void;
  onSave?: (data: GuidelineUpdate) => Promise<void>;
}

const weightVariant = {
  must: "danger" as const,
  should: "warning" as const,
  may: "default" as const,
};

const WEIGHTS: GuidelineWeight[] = ["must", "should", "may"];
const SCOPES = ["global", "backend", "frontend", "api", "database", "testing", "devops"];

export function GuidelineCard({ guideline, editing, onEditToggle, onSave }: GuidelineCardProps) {
  const [form, setForm] = useState<GuidelineUpdate>({
    title: guideline.title,
    content: guideline.content,
    scope: guideline.scope,
    weight: guideline.weight,
    rationale: guideline.rationale ?? "",
    tags: [...guideline.tags],
    status: guideline.status,
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !(form.tags ?? []).includes(tag)) {
      setForm({ ...form, tags: [...(form.tags ?? []), tag] });
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setForm({ ...form, tags: (form.tags ?? []).filter((t) => t !== tag) });
  };

  if (editing) {
    return (
      <div className="rounded-lg border-2 border-forge-300 bg-forge-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{guideline.id} — Editing</span>
          <div className="flex gap-2">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "DEPRECATED" })}
              className="rounded-md border px-2 py-1 text-xs focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DEPRECATED">DEPRECATED</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Scope</label>
              <select
                value={form.scope ?? guideline.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Weight</label>
              <select
                value={form.weight ?? guideline.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value as GuidelineWeight })}
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              >
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Content</label>
          <textarea
            value={form.content ?? ""}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Rationale</label>
          <input
            type="text"
            value={form.rationale ?? ""}
            onChange={(e) => setForm({ ...form, rationale: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Tags</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
              placeholder="Add tag..."
              className="flex-1 rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="rounded-md border px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Add
            </button>
          </div>
          {(form.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(form.tags ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {t}
                  <button onClick={() => handleRemoveTag(t)} className="text-gray-400 hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-forge-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-forge-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onEditToggle}
            className="rounded-md border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 hover:border-forge-300 transition-colors group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{guideline.id}</span>
        <Badge variant={statusVariant(guideline.status)}>{guideline.status}</Badge>
        <Badge variant={weightVariant[guideline.weight]}>{guideline.weight.toUpperCase()}</Badge>
        {onEditToggle && (
          <button
            onClick={onEditToggle}
            className="ml-auto text-xs text-gray-400 hover:text-forge-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </button>
        )}
      </div>
      <h3 className="font-medium text-sm">{guideline.title}</h3>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{guideline.content}</p>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
        <span>scope: {guideline.scope}</span>
        {guideline.tags.length > 0 && (
          <span>tags: {guideline.tags.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { ACTemplate, ACTemplateUpdate, ACTemplateCategory } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";

interface ACTemplateCardProps {
  template: ACTemplate;
  editing?: boolean;
  onEditToggle?: () => void;
  onSave?: (data: ACTemplateUpdate) => Promise<void>;
  onInstantiate?: (templateId: string) => void;
}

const CATEGORIES: ACTemplateCategory[] = [
  "performance", "security", "quality", "functionality",
  "accessibility", "reliability", "data-integrity", "ux",
];

const categoryVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  performance: "warning",
  security: "danger",
  quality: "info",
  functionality: "success",
  accessibility: "info",
  reliability: "warning",
  "data-integrity": "danger",
  ux: "success",
};

export function ACTemplateCard({ template, editing, onEditToggle, onSave, onInstantiate }: ACTemplateCardProps) {
  const [form, setForm] = useState<ACTemplateUpdate>({
    title: template.title,
    template: template.template,
    description: template.description ?? "",
    category: template.category,
    verification_method: template.verification_method ?? "",
    tags: [...template.tags],
    scopes: [...template.scopes],
    status: template.status,
  });
  const [tagInput, setTagInput] = useState("");
  const [scopeInput, setScopeInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Preview: show template with placeholders highlighted
  const renderTemplatePreview = (tmpl: string) => {
    const parts = tmpl.split(/(\{[^}]+\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{[^}]+\}$/)) {
        return (
          <span key={i} className="inline-flex items-center rounded bg-forge-100 text-forge-700 px-1 text-xs font-mono">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

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

  const handleAddScope = () => {
    const scope = scopeInput.trim();
    if (scope && !(form.scopes ?? []).includes(scope)) {
      setForm({ ...form, scopes: [...(form.scopes ?? []), scope] });
    }
    setScopeInput("");
  };

  const handleRemoveScope = (scope: string) => {
    setForm({ ...form, scopes: (form.scopes ?? []).filter((s) => s !== scope) });
  };

  if (editing) {
    return (
      <div className="rounded-lg border-2 border-forge-300 bg-forge-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{template.id} — Editing</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "DEPRECATED" })}
            className="rounded-md border px-2 py-1 text-xs focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DEPRECATED">DEPRECATED</option>
          </select>
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={form.category ?? template.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input
            type="text"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Template (use {"{param}"} for parameters)</label>
          <textarea
            value={form.template ?? ""}
            onChange={(e) => setForm({ ...form, template: e.target.value })}
            rows={3}
            className="w-full rounded-md border px-3 py-1.5 text-sm font-mono focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Verification Method</label>
          <input
            type="text"
            value={form.verification_method ?? ""}
            onChange={(e) => setForm({ ...form, verification_method: e.target.value })}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
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
              <button type="button" onClick={handleAddTag} className="rounded-md border px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Add</button>
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scopes</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={scopeInput}
                onChange={(e) => setScopeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddScope(); } }}
                placeholder="Add scope..."
                className="flex-1 rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              />
              <button type="button" onClick={handleAddScope} className="rounded-md border px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Add</button>
            </div>
            {(form.scopes ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(form.scopes ?? []).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    {s}
                    <button onClick={() => handleRemoveScope(s)} className="text-blue-400 hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
        <span className="text-xs text-gray-400">{template.id}</span>
        <Badge variant={statusVariant(template.status)}>{template.status}</Badge>
        <Badge variant={categoryVariant[template.category] ?? "default"}>{template.category}</Badge>
        {template.usage_count != null && template.usage_count > 0 && (
          <span className="text-[10px] text-gray-400">used {template.usage_count}x</span>
        )}
        <div className="ml-auto flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onInstantiate && template.status === "ACTIVE" && (
            <button
              onClick={() => onInstantiate(template.id)}
              className="text-xs text-forge-600 hover:text-forge-800 font-medium"
            >
              Instantiate
            </button>
          )}
          {onEditToggle && (
            <button
              onClick={onEditToggle}
              className="text-xs text-gray-400 hover:text-forge-600"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <h3 className="font-medium text-sm">{template.title}</h3>
      {template.description && (
        <p className="text-xs text-gray-500 mt-1">{template.description}</p>
      )}
      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono">
        {renderTemplatePreview(template.template)}
      </div>
      {template.parameters && template.parameters.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] text-gray-400">Parameters: </span>
          {template.parameters.map((p) => (
            <span key={p.name} className="inline-flex items-center text-[10px] bg-forge-50 text-forge-600 px-1.5 py-0.5 rounded mr-1">
              {p.name}
              {p.type && <span className="ml-0.5 text-gray-400">:{p.type}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
        {template.scopes.length > 0 && (
          <span>scopes: {template.scopes.join(", ")}</span>
        )}
        {template.tags.length > 0 && (
          <span>tags: {template.tags.join(", ")}</span>
        )}
        {template.verification_method && (
          <span>verify: {template.verification_method}</span>
        )}
      </div>
    </div>
  );
}

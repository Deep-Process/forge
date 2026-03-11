"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useEntityStore } from "@/stores/entityStore";
import { ACTemplateCard } from "@/components/entities/ACTemplateCard";
import { StatusFilter } from "@/components/shared/StatusFilter";
import { acTemplates as acTemplatesApi } from "@/lib/api";
import type { ACTemplate, ACTemplateCreate, ACTemplateCategory } from "@/lib/types";

const STATUSES = ["ACTIVE", "DEPRECATED"];
const CATEGORIES: ACTemplateCategory[] = [
  "performance", "security", "quality", "functionality",
  "accessibility", "reliability", "data-integrity", "ux",
];

const emptyForm: ACTemplateCreate = {
  title: "",
  template: "",
  category: "functionality",
  description: "",
  parameters: [],
  scopes: [],
  tags: [],
  verification_method: "",
};

interface ParamDef {
  name: string;
  type: string;
  default?: string;
  description?: string;
}

export default function ACTemplatesPage() {
  const { slug } = useParams() as { slug: string };
  const { slices, fetchEntities, createACTemplate, updateACTemplate } = useEntityStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<ACTemplateCreate>({ ...emptyForm });
  const [paramDefs, setParamDefs] = useState<ParamDef[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [scopeInput, setScopeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Instantiate state
  const [instantiateId, setInstantiateId] = useState<string | null>(null);
  const [instantiateParams, setInstantiateParams] = useState<Record<string, string>>({});
  const [instantiateResult, setInstantiateResult] = useState<string | null>(null);
  const [instantiating, setInstantiating] = useState(false);
  const [instantiateError, setInstantiateError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntities(slug, "acTemplates");
  }, [slug, fetchEntities]);

  const templates = slices.acTemplates.items as ACTemplate[];
  const filtered = templates
    .filter((t) => !statusFilter || t.status === statusFilter)
    .filter((t) => !categoryFilter || t.category === categoryFilter);

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

  const handleAddParam = () => {
    setParamDefs([...paramDefs, { name: "", type: "string", default: "", description: "" }]);
  };

  const handleRemoveParam = (index: number) => {
    setParamDefs(paramDefs.filter((_, i) => i !== index));
  };

  const handleUpdateParam = (index: number, field: keyof ParamDef, value: string) => {
    const updated = [...paramDefs];
    updated[index] = { ...updated[index], [field]: value };
    setParamDefs(updated);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.template.trim()) return;
    setCreating(true);
    try {
      const params = paramDefs
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          type: p.type || "string",
          ...(p.default ? { default: p.default } : {}),
          ...(p.description ? { description: p.description } : {}),
        }));
      await createACTemplate(slug, [{ ...form, parameters: params }]);
      setForm({ ...emptyForm });
      setParamDefs([]);
      setShowCreateForm(false);
      await fetchEntities(slug, "acTemplates");
    } finally {
      setCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setForm({ ...emptyForm });
    setParamDefs([]);
    setTagInput("");
    setScopeInput("");
    setShowCreateForm(false);
  };

  // Instantiate flow
  const instantiateTemplate = templates.find((t) => t.id === instantiateId);

  const handleOpenInstantiate = useCallback((templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const defaults: Record<string, string> = {};
    for (const p of tmpl.parameters ?? []) {
      defaults[p.name] = p.default != null ? String(p.default) : "";
    }
    setInstantiateParams(defaults);
    setInstantiateResult(null);
    setInstantiateError(null);
    setInstantiateId(templateId);
  }, [templates]);

  const handleInstantiate = async () => {
    if (!instantiateId) return;
    setInstantiating(true);
    setInstantiateError(null);
    try {
      const res = await acTemplatesApi.instantiate(slug, instantiateId, instantiateParams);
      setInstantiateResult(res.criterion);
      await fetchEntities(slug, "acTemplates");
    } catch (e) {
      setInstantiateError((e as Error).message);
    } finally {
      setInstantiating(false);
    }
  };

  const handleCloseInstantiate = () => {
    setInstantiateId(null);
    setInstantiateParams({});
    setInstantiateResult(null);
    setInstantiateError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">AC Templates ({slices.acTemplates.count})</h2>
        <div className="flex gap-3 items-center">
          <StatusFilter options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          <StatusFilter options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} label="Category" />
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-md bg-forge-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forge-700 transition-colors"
          >
            {showCreateForm ? "Cancel" : "+ New Template"}
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showCreateForm && (
        <div className="rounded-lg border-2 border-dashed border-forge-300 bg-forge-50 p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">Create New AC Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Template title..."
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ACTemplateCategory })}
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of what this template checks..."
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">
              Template * <span className="text-gray-400">(use {"{param_name}"} for parameters)</span>
            </label>
            <textarea
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
              placeholder="Response time for {endpoint} must be under {threshold_ms}ms at p95"
              rows={3}
              className="w-full rounded-md border px-3 py-1.5 text-sm font-mono focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Verification Method</label>
            <input
              type="text"
              value={form.verification_method ?? ""}
              onChange={(e) => setForm({ ...form, verification_method: e.target.value })}
              placeholder="How to verify this criterion (e.g., load test, code review, unit test)"
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
            />
          </div>

          {/* Parameters */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500">Parameters</label>
              <button
                type="button"
                onClick={handleAddParam}
                className="text-xs text-forge-600 hover:text-forge-800"
              >
                + Add Parameter
              </button>
            </div>
            {paramDefs.map((p, i) => (
              <div key={i} className="flex gap-2 items-start mb-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => handleUpdateParam(i, "name", e.target.value)}
                  placeholder="name"
                  className="w-28 rounded-md border px-2 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                />
                <select
                  value={p.type}
                  onChange={(e) => handleUpdateParam(i, "type", e.target.value)}
                  className="w-24 rounded-md border px-2 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
                <input
                  type="text"
                  value={p.default ?? ""}
                  onChange={(e) => handleUpdateParam(i, "default", e.target.value)}
                  placeholder="default"
                  className="w-28 rounded-md border px-2 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                />
                <input
                  type="text"
                  value={p.description ?? ""}
                  onChange={(e) => handleUpdateParam(i, "description", e.target.value)}
                  placeholder="description"
                  className="flex-1 rounded-md border px-2 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                />
                <button
                  onClick={() => handleRemoveParam(i)}
                  className="text-gray-400 hover:text-red-500 px-1 py-1.5 text-sm"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Tags and Scopes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
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

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating || !form.title.trim() || !form.template.trim()}
              className="rounded-md bg-forge-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-forge-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create Template"}
            </button>
            <button
              onClick={handleCancelCreate}
              className="rounded-md border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Instantiate modal */}
      {instantiateId && instantiateTemplate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-sm font-semibold mb-1">Instantiate Template</h3>
            <p className="text-xs text-gray-500 mb-4">{instantiateTemplate.title}</p>

            <div className="mb-4 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600">
              {instantiateTemplate.template}
            </div>

            {(instantiateTemplate.parameters ?? []).length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-xs text-gray-500 font-medium">Fill in parameters:</p>
                {(instantiateTemplate.parameters ?? []).map((p) => (
                  <div key={p.name}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {p.name}
                      {p.type && <span className="text-gray-400 ml-1">({p.type})</span>}
                      {p.description && <span className="text-gray-400 ml-1">- {p.description}</span>}
                    </label>
                    <input
                      type="text"
                      value={instantiateParams[p.name] ?? ""}
                      onChange={(e) => setInstantiateParams({ ...instantiateParams, [p.name]: e.target.value })}
                      placeholder={p.default != null ? `default: ${p.default}` : `Enter ${p.name}...`}
                      className="w-full rounded-md border px-3 py-1.5 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {instantiateResult && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 font-medium mb-1">Generated AC:</p>
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                  {instantiateResult}
                </div>
              </div>
            )}

            {instantiateError && (
              <p className="text-sm text-red-600 mb-4">{instantiateError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCloseInstantiate}
                className="rounded-md border px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {!instantiateResult && (
                <button
                  onClick={handleInstantiate}
                  disabled={instantiating}
                  className="rounded-md bg-forge-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-forge-700 disabled:opacity-50 transition-colors"
                >
                  {instantiating ? "Generating..." : "Generate AC"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {slices.acTemplates.loading && <p className="text-sm text-gray-400">Loading...</p>}
      {slices.acTemplates.error && <p className="text-sm text-red-600 mb-2">{slices.acTemplates.error}</p>}
      <div className="space-y-3">
        {filtered.map((t) => (
          <ACTemplateCard
            key={t.id}
            template={t}
            editing={editingId === t.id}
            onEditToggle={() => setEditingId(editingId === t.id ? null : t.id)}
            onSave={async (data) => {
              await updateACTemplate(slug, t.id, data);
              setEditingId(null);
              await fetchEntities(slug, "acTemplates");
            }}
            onInstantiate={handleOpenInstantiate}
          />
        ))}
        {!slices.acTemplates.loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No templates matching filters</p>
        )}
      </div>
    </div>
  );
}

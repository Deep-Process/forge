"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { acTemplates as acTemplatesApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { ACTemplate, ACTemplateUpdate, ACTemplateCategory } from "@/lib/types";

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
  ux: "default",
};

interface ParamDef {
  name: string;
  type: string;
  default?: string;
  description?: string;
}

export default function ACTemplateDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  const router = useRouter();
  const [template, setTemplate] = useState<ACTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<ACTemplateCategory>("functionality");
  const [editTemplate, setEditTemplate] = useState("");
  const [editVerificationMethod, setEditVerificationMethod] = useState("");
  const [editParams, setEditParams] = useState<ParamDef[]>([]);
  const [editScopes, setEditScopes] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Instantiate state
  const [instantiateOpen, setInstantiateOpen] = useState(false);
  const [instantiateParams, setInstantiateParams] = useState<Record<string, string>>({});
  const [instantiateResult, setInstantiateResult] = useState<string | null>(null);
  const [instantiating, setInstantiating] = useState(false);
  const [instantiateError, setInstantiateError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await acTemplatesApi.get(slug, id);
      setTemplate(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const startEdit = () => {
    if (!template) return;
    setEditTitle(template.title);
    setEditDescription(template.description || "");
    setEditCategory(template.category);
    setEditTemplate(template.template);
    setEditVerificationMethod(template.verification_method || "");
    setEditParams(
      (template.parameters || []).map((p) => ({
        name: p.name,
        type: p.type,
        default: p.default != null ? String(p.default) : undefined,
        description: p.description,
      }))
    );
    setEditScopes([...template.scopes]);
    setEditTags([...template.tags]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const update: ACTemplateUpdate = {};
      if (editTitle !== template.title) update.title = editTitle;
      if (editDescription !== (template.description || "")) update.description = editDescription;
      if (editCategory !== template.category) update.category = editCategory;
      if (editTemplate !== template.template) update.template = editTemplate;
      if (editVerificationMethod !== (template.verification_method || "")) update.verification_method = editVerificationMethod;
      if (JSON.stringify(editScopes) !== JSON.stringify(template.scopes)) update.scopes = editScopes;
      if (JSON.stringify(editTags) !== JSON.stringify(template.tags)) update.tags = editTags;

      // Build parameters
      const cleanParams = editParams
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          type: p.type || "string",
          ...(p.default ? { default: p.default } : {}),
          ...(p.description ? { description: p.description } : {}),
        }));
      const origParams = (template.parameters || []).map((p) => ({
        name: p.name,
        type: p.type,
        ...(p.default != null ? { default: String(p.default) } : {}),
        ...(p.description ? { description: p.description } : {}),
      }));
      if (JSON.stringify(cleanParams) !== JSON.stringify(origParams)) {
        update.parameters = cleanParams;
      }

      if (Object.keys(update).length > 0) {
        const updated = await acTemplatesApi.update(slug, id, update);
        setTemplate(updated);
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await acTemplatesApi.remove(slug, id);
      router.push(`/projects/${slug}/ac-templates`);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // Instantiate flow
  const openInstantiate = () => {
    if (!template) return;
    const defaults: Record<string, string> = {};
    for (const p of template.parameters ?? []) {
      defaults[p.name] = p.default != null ? String(p.default) : "";
    }
    setInstantiateParams(defaults);
    setInstantiateResult(null);
    setInstantiateError(null);
    setInstantiateOpen(true);
  };

  const handleInstantiate = async () => {
    setInstantiating(true);
    setInstantiateError(null);
    try {
      const res = await acTemplatesApi.instantiate(slug, id, instantiateParams);
      setInstantiateResult(res.criterion);
      // Refresh to get updated usage_count
      await fetchTemplate();
    } catch (e) {
      setInstantiateError((e as Error).message);
    } finally {
      setInstantiating(false);
    }
  };

  const closeInstantiate = () => {
    setInstantiateOpen(false);
    setInstantiateParams({});
    setInstantiateResult(null);
    setInstantiateError(null);
  };

  // Status toggle
  const handleStatusToggle = async () => {
    if (!template) return;
    const newStatus = template.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE";
    try {
      const updated = await acTemplatesApi.update(slug, id, { status: newStatus });
      setTemplate(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Edit param helpers
  const handleAddParam = () => {
    setEditParams([...editParams, { name: "", type: "string", default: "", description: "" }]);
  };

  const handleRemoveParam = (index: number) => {
    setEditParams(editParams.filter((_, i) => i !== index));
  };

  const handleUpdateParam = (index: number, field: keyof ParamDef, value: string) => {
    const updated = [...editParams];
    updated[index] = { ...updated[index], [field]: value };
    setEditParams(updated);
  };

  // Highlight template params in read mode
  const highlightTemplate = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/g);
    return parts.map((part, i) =>
      part.startsWith("{") && part.endsWith("}") ? (
        <span key={i} className="text-forge-600 font-semibold bg-forge-50 px-0.5 rounded">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // --- AI Annotations ---
  useAIPage({
    id: "ac-template-detail",
    title: template ? `AC Template ${template.id} — ${template.title}` : "AC Template Detail (loading)",
    description: template ? `${template.category} — ${template.status}` : "Loading...",
    route: `/projects/${slug}/ac-templates/${id}`,
  });

  useAIElement({
    id: "ac-template-entity",
    type: "display",
    label: template ? `AC Template ${template.id}` : "AC Template",
    description: template ? `${template.status} ${template.category} template` : undefined,
    data: template ? {
      status: template.status,
      category: template.category,
      usage_count: template.usage_count,
      parameters_count: template.parameters?.length ?? 0,
    } : undefined,
    actions: [
      { label: "Instantiate", toolName: "instantiateACTemplate", toolParams: ["template_id*", "params*"] },
      { label: "Update", toolName: "updateACTemplate", toolParams: ["id*", "title", "template", "category", "status"] },
    ],
  });

  if (loading) return <p className="text-sm text-gray-400">Loading template...</p>;
  if (error && !template) return <p className="text-sm text-red-600">{error}</p>;
  if (!template) return <p className="text-sm text-gray-400">Template not found</p>;

  return (
    <div className="space-y-6">
      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete ${template.id}?`}
        description="This will permanently remove this AC template and cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleting}
      />

      {/* Instantiate modal */}
      {instantiateOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-sm font-semibold mb-1">Instantiate Template</h3>
            <p className="text-xs text-gray-500 mb-4">{template.title}</p>

            <div className="mb-4 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600">
              {template.template}
            </div>

            {(template.parameters ?? []).length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-xs text-gray-500 font-medium">Fill in parameters:</p>
                {(template.parameters ?? []).map((p) => (
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
                onClick={closeInstantiate}
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

      {/* Header */}
      <div>
        <button
          onClick={() => router.push(`/projects/${slug}/ac-templates`)}
          className="text-xs text-gray-400 hover:text-gray-600 mb-2"
        >
          &larr; Back to AC Templates
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-mono">{template.id}</span>
            <Badge variant={statusVariant(template.status)}>{template.status}</Badge>
            <Badge variant={categoryVariant[template.category] || "default"}>{template.category}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <button
                  onClick={openInstantiate}
                  disabled={template.status !== "ACTIVE"}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-forge-600 rounded hover:bg-forge-700 disabled:opacity-50"
                >
                  Instantiate
                </button>
                <button
                  onClick={handleStatusToggle}
                  className={`px-3 py-1.5 text-xs font-medium border rounded ${
                    template.status === "ACTIVE"
                      ? "text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                      : "text-green-700 border-green-300 hover:bg-green-50"
                  }`}
                >
                  {template.status === "ACTIVE" ? "Deprecate" : "Activate"}
                </button>
                <button
                  onClick={startEdit}
                  className="px-3 py-1.5 text-xs font-medium text-forge-700 border border-forge-300 rounded hover:bg-forge-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        <h1 className="text-xl font-semibold mt-2">{template.title}</h1>
        {template.description && (
          <p className="text-sm text-gray-500 mt-1">{template.description}</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600">Dismiss</button>
        </div>
      )}

      {editing ? (
        /* ===== Edit mode ===== */
        <div className="space-y-5 border rounded-lg p-5 bg-gray-50">
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Core</legend>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ACTemplateCategory)}
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Template * <span className="text-gray-400">(use {"{param_name}"} for parameters)</span>
                </label>
                <textarea
                  value={editTemplate}
                  onChange={(e) => setEditTemplate(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Verification Method</label>
                <input
                  value={editVerificationMethod}
                  onChange={(e) => setEditVerificationMethod(e.target.value)}
                  placeholder="How to verify this criterion"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Parameters</legend>
            {editParams.map((p, i) => (
              <div key={i} className="flex gap-2 items-start mb-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => handleUpdateParam(i, "name", e.target.value)}
                  placeholder="name"
                  className="w-28 rounded-md border px-2 py-1.5 text-sm"
                />
                <select
                  value={p.type}
                  onChange={(e) => handleUpdateParam(i, "type", e.target.value)}
                  className="w-24 rounded-md border px-2 py-1.5 text-sm"
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
                  className="w-28 rounded-md border px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={p.description ?? ""}
                  onChange={(e) => handleUpdateParam(i, "description", e.target.value)}
                  placeholder="description"
                  className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleRemoveParam(i)}
                  className="text-xs text-red-400 hover:text-red-600 py-1.5"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={handleAddParam}
              className="text-xs text-forge-600 hover:underline mt-1"
            >
              + Add parameter
            </button>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metadata</legend>
            <EditableList items={editScopes} setItems={setEditScopes} label="Scopes" addLabel="Add scope" />
            <div className="mt-3">
              <EditableList items={editTags} setItems={setEditTags} label="Tags" addLabel="Add tag" />
            </div>
          </fieldset>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-forge-600 rounded hover:bg-forge-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-sm text-gray-600 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ===== Read mode ===== */
        <>
          {/* Template text */}
          <div className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold mb-2">Template</h2>
            <div className="bg-gray-50 rounded-md p-4 font-mono text-sm whitespace-pre-wrap">
              {highlightTemplate(template.template)}
            </div>
          </div>

          {/* Parameters */}
          {(template.parameters ?? []).length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold mb-2">
                Parameters ({template.parameters!.length})
              </h2>
              <div className="space-y-2">
                {template.parameters!.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="text-forge-600 font-mono bg-forge-50 px-1.5 py-0.5 rounded text-xs">
                      {"{" + p.name + "}"}
                    </code>
                    <div className="flex-1">
                      <span className="text-xs text-gray-400">{p.type}</span>
                      {p.default != null && (
                        <span className="text-xs text-gray-400 ml-2">
                          default: <code className="text-gray-600">{String(p.default)}</code>
                        </span>
                      )}
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Method */}
          {template.verification_method && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold mb-2">Verification Method</h2>
              <p className="text-sm text-gray-700">{template.verification_method}</p>
            </div>
          )}

          {/* Stats & Metadata */}
          <div className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold mb-2">Details</h2>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <span className="font-medium text-gray-600 block">Usage Count</span>
                <span className="text-sm font-semibold text-gray-800">{template.usage_count ?? 0}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600 block">Created</span>
                <span>{new Date(template.created_at).toLocaleDateString()}</span>
              </div>
              {template.scopes.length > 0 && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-600 block mb-1">Scopes</span>
                  <div className="flex flex-wrap gap-1">
                    {template.scopes.map((s) => (
                      <span key={s} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {template.tags.length > 0 && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-600 block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((t) => (
                      <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Source Tasks */}
          {(() => {
            const sourceTasks = (template as unknown as Record<string, unknown>).source_tasks as string[] | undefined;
            if (!sourceTasks || sourceTasks.length === 0) return null;
            return (
              <div className="rounded-lg border bg-white p-4">
                <h2 className="text-sm font-semibold mb-2">
                  Source Tasks ({sourceTasks.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {sourceTasks.map((taskId) => (
                    <span key={taskId} className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {taskId}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Editable list helper
 * --------------------------------------------------------------------------- */

function EditableList({
  items, setItems, label, addLabel, rows = 1,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  label: string;
  addLabel: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} ({items.length})
      </label>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 mb-1">
          {rows > 1 ? (
            <textarea
              value={item}
              onChange={(e) => { const next = [...items]; next[i] = e.target.value; setItems(next); }}
              rows={rows}
              className="flex-1 rounded-md border px-2 py-1 text-xs"
            />
          ) : (
            <input
              value={item}
              onChange={(e) => { const next = [...items]; next[i] = e.target.value; setItems(next); }}
              className="flex-1 rounded-md border px-2 py-1 text-xs"
            />
          )}
          <button
            onClick={() => setItems(items.filter((_, j) => j !== i))}
            className="text-xs text-red-400 hover:text-red-600 mt-1"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={() => setItems([...items, ""])}
        className="text-xs text-forge-600 hover:underline mt-1"
      >
        + {addLabel}
      </button>
    </div>
  );
}

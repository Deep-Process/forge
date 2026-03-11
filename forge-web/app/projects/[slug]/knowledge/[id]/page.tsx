"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { knowledge as knowledgeApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import type { Knowledge, KnowledgeUpdate } from "@/lib/types";

type Tab = "content" | "versions" | "links" | "impact";

interface Version {
  version: number;
  content: string;
  change_reason: string;
  changed_by: string;
}

interface AffectedEntity {
  entity_type: string;
  entity_id: string;
  name?: string;
  relation?: string;
}

export default function KnowledgeDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  const router = useRouter();
  const [item, setItem] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Versions state
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  // Impact state
  const [affected, setAffected] = useState<AffectedEntity[]>([]);
  const [impactLoading, setImpactLoading] = useState(false);

  // Link management state
  const [linkType, setLinkType] = useState("task");
  const [linkEntityId, setLinkEntityId] = useState("");
  const [linkRelation, setLinkRelation] = useState("reference");
  const [linkError, setLinkError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeApi.get(slug, id);
      setItem(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const res = await knowledgeApi.versions(slug, id);
      setVersions(res.versions as unknown as Version[]);
    } catch {
      // versions may not exist yet
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, [slug, id]);

  const fetchImpact = useCallback(async () => {
    setImpactLoading(true);
    try {
      const res = await knowledgeApi.impact(slug, id);
      setAffected(res.affected_entities as unknown as AffectedEntity[]);
    } catch {
      setAffected([]);
    } finally {
      setImpactLoading(false);
    }
  }, [slug, id]);

  // Load tab data on switch
  useEffect(() => {
    if (tab === "versions") fetchVersions();
    if (tab === "impact") fetchImpact();
  }, [tab, fetchVersions, fetchImpact]);

  const startEditing = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditContent(item.content);
    setChangeReason("");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updates: KnowledgeUpdate = {};
      if (editTitle !== item.title) updates.title = editTitle;
      if (editContent !== item.content) {
        updates.content = editContent;
        updates.change_reason = changeReason || "Updated via web UI";
        updates.changed_by = "user";
      }
      if (Object.keys(updates).length > 0) {
        const updated = await knowledgeApi.update(slug, id, updates);
        setItem(updated);
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addLink = async () => {
    if (!linkEntityId.trim()) return;
    setLinkError(null);
    try {
      await knowledgeApi.link(slug, id, {
        entity_type: linkType as "task",
        entity_id: linkEntityId.trim(),
        relation: linkRelation as "reference",
      });
      setLinkEntityId("");
      fetchItem(); // refresh to show new link
    } catch (e) {
      setLinkError((e as Error).message);
    }
  };

  const removeLink = async (linkId: number) => {
    try {
      await knowledgeApi.unlink(slug, id, linkId);
      fetchItem();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;
  if (!item && error) return <p className="text-sm text-red-600">{error}</p>;
  if (!item) return <p className="text-sm text-gray-400">Not found</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "content", label: "Content" },
    { key: "versions", label: "Versions" },
    { key: "links", label: `Links (${item.linked_entities.length})` },
    { key: "impact", label: "Impact" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600">&larr; Back</button>
        <span className="text-xs text-gray-400">{item.id}</span>
        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
        <Badge>{item.category}</Badge>
      </div>
      <h2 className="text-lg font-semibold mb-1">{item.title}</h2>
      <div className="flex gap-2 text-xs text-gray-400 mb-4">
        {item.scopes.length > 0 && <span>scopes: {item.scopes.join(", ")}</span>}
        <span>created by: {item.created_by}</span>
        <span>review: every {item.review_interval_days}d</span>
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {item.tags.map((t) => (
            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}

      {/* Inline error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-forge-500 text-forge-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "content" && (
        <div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown)</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={16}
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                />
              </div>
              {editContent !== item.content && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Change reason</label>
                  <input
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Why is this being changed?"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-forge-500 focus:ring-1 focus:ring-forge-500"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-forge-600 text-white rounded-md text-sm hover:bg-forge-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-2">
                <button
                  onClick={startEditing}
                  className="text-xs text-forge-600 hover:text-forge-700 font-medium"
                >
                  Edit
                </button>
              </div>
              <div className="prose prose-sm max-w-none rounded-lg border bg-gray-50 p-4 whitespace-pre-wrap font-mono text-sm">
                {item.content}
              </div>
            </div>
          )}
          {/* Dependencies */}
          {item.dependencies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Dependencies</h3>
              <div className="flex flex-wrap gap-1">
                {item.dependencies.map((d) => (
                  <span key={d} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "versions" && (
        <div>
          {versionsLoading && <p className="text-sm text-gray-400">Loading versions...</p>}
          {!versionsLoading && versions.length === 0 && (
            <p className="text-sm text-gray-400">No version history yet. Versions are created when content is updated.</p>
          )}
          <div className="space-y-3">
            {versions.map((v) => (
              <div key={v.version} className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>v{v.version}</Badge>
                    <span className="text-xs text-gray-500">by {v.changed_by}</span>
                  </div>
                  <button
                    onClick={() => setExpandedVersion(expandedVersion === v.version ? null : v.version)}
                    className="text-xs text-forge-600 hover:text-forge-700"
                  >
                    {expandedVersion === v.version ? "Hide" : "Show content"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{v.change_reason}</p>
                {expandedVersion === v.version && (
                  <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {v.content}
                  </pre>
                )}
              </div>
            ))}
          </div>
          {/* Current version */}
          {item && (
            <div className="mt-3 rounded-lg border border-forge-200 bg-forge-50 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">Current</Badge>
                <span className="text-xs text-gray-500">v{versions.length + 1} (active)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "links" && (
        <div>
          {/* Existing links */}
          <div className="space-y-2 mb-4">
            {item.linked_entities.length === 0 && (
              <p className="text-sm text-gray-400">No linked entities</p>
            )}
            {item.linked_entities.map((le, i) => {
              const linkId = (le as Record<string, unknown>).link_id as number | undefined;
              return (
                <div key={i} className="flex items-center justify-between rounded-lg border bg-white p-3">
                  <div className="flex items-center gap-2">
                    <Badge>{String(le.entity_type ?? "")}</Badge>
                    <span className="text-sm font-medium">{String(le.entity_id ?? "")}</span>
                    <span className="text-xs text-gray-400">{String(le.relation ?? "")}</span>
                  </div>
                  {linkId != null && (
                    <button
                      onClick={() => removeLink(linkId)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Add link form */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <h3 className="text-sm font-medium mb-3">Add Link</h3>
            {linkError && <p className="text-xs text-red-600 mb-2">{linkError}</p>}
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-sm"
                >
                  {["task", "idea", "objective", "knowledge", "guideline", "lesson"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entity ID</label>
                <input
                  value={linkEntityId}
                  onChange={(e) => setLinkEntityId(e.target.value)}
                  placeholder="T-001, K-002..."
                  className="rounded-md border px-2 py-1.5 text-sm w-32"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Relation</label>
                <select
                  value={linkRelation}
                  onChange={(e) => setLinkRelation(e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-sm"
                >
                  {["required", "context", "reference", "depends_on", "references", "derived-from", "supports", "contradicts"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addLink}
                className="px-3 py-1.5 bg-forge-600 text-white rounded-md text-sm hover:bg-forge-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "impact" && (
        <div>
          {impactLoading && <p className="text-sm text-gray-400">Analyzing impact...</p>}
          {!impactLoading && affected.length === 0 && (
            <p className="text-sm text-gray-400">No entities affected by this knowledge object.</p>
          )}
          <div className="space-y-2">
            {affected.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-white p-3">
                <Badge>{a.entity_type}</Badge>
                <span className="text-sm font-medium">{a.entity_id}</span>
                {a.name && <span className="text-xs text-gray-500">{a.name}</span>}
                {a.relation && <span className="text-xs text-gray-400">({a.relation})</span>}
              </div>
            ))}
          </div>
          {!impactLoading && affected.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              {affected.length} entit{affected.length === 1 ? "y" : "ies"} affected.
              Changes to this knowledge may require updating these entities.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { objectives as objectivesApi, ideas as ideasApi, guidelines as guidelinesApi } from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import type { Objective, Idea, Guideline, KeyResult } from "@/lib/types";

export default function ObjectiveDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  const router = useRouter();
  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Related data
  const [linkedIdeas, setLinkedIdeas] = useState<Idea[]>([]);
  const [derivedGuidelines, setDerivedGuidelines] = useState<Guideline[]>([]);

  // Inline KR edit state
  const [editingKR, setEditingKR] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchObjective = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await objectivesApi.get(slug, id);
      setObjective(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    fetchObjective();
  }, [fetchObjective]);

  // Fetch linked ideas and derived guidelines
  useEffect(() => {
    if (!objective) return;
    const fetchRelated = async () => {
      try {
        const ideaRes = await ideasApi.list(slug);
        const matching = ideaRes.ideas.filter((idea) =>
          idea.advances_key_results.some((akr) => akr.startsWith(id))
        );
        setLinkedIdeas(matching);

        const glRes = await guidelinesApi.list(slug);
        const derived = glRes.guidelines.filter((g) => {
          // derived_from exists in API but not in TS type
          const gAny = g as unknown as { derived_from?: string };
          return gAny.derived_from === id;
        });
        setDerivedGuidelines(derived);
      } catch {
        // Silent fail for related data
      }
    };
    fetchRelated();
  }, [objective, slug, id]);

  const handleKRSave = async (krIndex: number) => {
    if (!objective) return;
    setSaving(true);
    try {
      const updatedKRs = objective.key_results.map((kr, i) =>
        i === krIndex ? { ...kr, current: parseFloat(editValue) || 0 } : kr
      );
      await objectivesApi.update(slug, id, { key_results: updatedKRs });
      setObjective({ ...objective, key_results: updatedKRs });
      setEditingKR(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Loading objective...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!objective) return <p className="text-sm text-gray-400">Objective not found</p>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2">
          &larr; Back
        </button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-gray-400 font-mono">{objective.id}</span>
          <Badge variant={statusVariant(objective.status)}>{objective.status}</Badge>
          <Badge>{objective.appetite}</Badge>
          <Badge variant="info">{objective.scope}</Badge>
        </div>
        <h1 className="text-xl font-bold">{objective.title}</h1>
        {objective.description && (
          <p className="text-sm text-gray-600 mt-2">{objective.description}</p>
        )}
        {objective.scopes.length > 0 && (
          <div className="flex gap-1 mt-2">
            {objective.scopes.map((s) => (
              <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Key Results */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Key Results ({objective.key_results.length})
        </h3>
        <div className="space-y-3">
          {objective.key_results.map((kr, i) => (
            <KRProgressBar
              key={i}
              kr={kr}
              index={i}
              editing={editingKR === i}
              editValue={editValue}
              saving={saving}
              onStartEdit={() => { setEditingKR(i); setEditValue(String(kr.current ?? 0)); }}
              onCancelEdit={() => setEditingKR(null)}
              onSave={() => handleKRSave(i)}
              onValueChange={setEditValue}
            />
          ))}
        </div>
      </section>

      {/* Linked Ideas */}
      {linkedIdeas.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Linked Ideas ({linkedIdeas.length})
          </h3>
          <div className="space-y-2">
            {linkedIdeas.map((idea) => (
              <Link
                key={idea.id}
                href={`/projects/${slug}/ideas/${idea.id}`}
                className="block rounded-lg border bg-white p-3 hover:border-forge-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">{idea.id}</span>
                  <Badge variant={statusVariant(idea.status)}>{idea.status}</Badge>
                  <Badge>{idea.category}</Badge>
                  <span className="text-sm text-gray-700">{idea.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Derived Guidelines */}
      {derivedGuidelines.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Derived Guidelines ({derivedGuidelines.length})
          </h3>
          <div className="space-y-2">
            {derivedGuidelines.map((g) => (
              <div key={g.id} className="rounded-lg border bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">{g.id}</span>
                  <Badge>{g.weight}</Badge>
                  <Badge>{g.scope}</Badge>
                </div>
                <p className="text-sm text-gray-700 mt-1">{g.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assumptions */}
      {objective.assumptions.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Assumptions ({objective.assumptions.length})
          </h3>
          <ul className="space-y-1">
            {objective.assumptions.map((a, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 shrink-0">-</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function KRProgressBar({
  kr, index, editing, editValue, saving,
  onStartEdit, onCancelEdit, onSave, onValueChange,
}: {
  kr: KeyResult;
  index: number;
  editing: boolean;
  editValue: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onValueChange: (v: string) => void;
}) {
  const baseline = kr.baseline ?? 0;
  const span = kr.target - baseline;
  const current = kr.current ?? baseline;
  const pct = span !== 0 ? Math.min(100, Math.max(0, Math.round((current - baseline) / span * 100))) : 0;

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          KR-{index + 1}: {kr.metric}
        </span>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="number"
                value={editValue}
                onChange={(e) => onValueChange(e.target.value)}
                className="w-20 text-xs border rounded px-2 py-1"
                autoFocus
              />
              <button
                onClick={onSave}
                disabled={saving}
                className="text-xs text-forge-600 hover:text-forge-700 font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={onCancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-500">
                {current} / {kr.target}
              </span>
              <button onClick={onStartEdit} className="text-xs text-gray-400 hover:text-forge-600">
                Edit
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-forge-500" : "bg-amber-500"
            }`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct}%</span>
      </div>
      {baseline > 0 && (
        <div className="text-[10px] text-gray-400 mt-1">Baseline: {baseline}</div>
      )}
    </div>
  );
}

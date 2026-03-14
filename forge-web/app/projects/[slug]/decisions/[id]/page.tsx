"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  decisions as decisionsApi,
  tasks as tasksApi,
  ideas as ideasApi,
  guidelines as guidelinesApi,
  llm,
} from "@/lib/api";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EntityLink } from "@/components/shared/EntityLink";
import { useAIPage, useAIElement } from "@/lib/ai-context";
import type { Decision, DecisionUpdate, DecisionStatus, Task, Idea, Guideline, ChatSession } from "@/lib/types";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["CLOSED", "DEFERRED", "ANALYZING"],
  ANALYZING: ["OPEN", "CLOSED", "DEFERRED", "MITIGATED", "ACCEPTED"],
  DEFERRED: ["OPEN", "CLOSED"],
  MITIGATED: ["CLOSED"],
  ACCEPTED: ["CLOSED"],
  CLOSED: [],
};

const ENTITY_TYPE_OPTIONS = ["", "task", "idea", "objective", "research"];

export default function DecisionDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core edit state
  const [editTaskId, setEditTaskId] = useState("");
  const [editIssue, setEditIssue] = useState("");
  const [editRecommendation, setEditRecommendation] = useState("");
  const [editReasoning, setEditReasoning] = useState("");
  const [editAlternatives, setEditAlternatives] = useState<string[]>([]);
  const [editConfidence, setEditConfidence] = useState("MEDIUM");
  const [editStatus, setEditStatus] = useState("OPEN");
  const [editDecidedBy, setEditDecidedBy] = useState("claude");
  const [editResolutionNotes, setEditResolutionNotes] = useState("");

  // Metadata edit state
  const [editFile, setEditFile] = useState("");
  const [editScope, setEditScope] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editEvidenceRefs, setEditEvidenceRefs] = useState<string[]>([]);

  // Linked entity
  const [editLinkedEntityType, setEditLinkedEntityType] = useState("");
  const [editLinkedEntityId, setEditLinkedEntityId] = useState("");

  // Risk fields
  const [editSeverity, setEditSeverity] = useState("");
  const [editLikelihood, setEditLikelihood] = useState("");
  const [editMitigationPlan, setEditMitigationPlan] = useState("");

  // Exploration fields
  const [editExplorationType, setEditExplorationType] = useState("");
  const [editOpenQuestions, setEditOpenQuestions] = useState<string[]>([]);
  const [editBlockers, setEditBlockers] = useState<string[]>([]);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDecision = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await decisionsApi.get(slug, id);
      setDecision(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  // --- AI Annotations ---
  useAIPage({
    id: "decision-detail",
    title: decision ? `Decision ${decision.id}` : "Decision Detail (loading)",
    description: decision ? `${decision.type} — ${decision.status}` : "Loading...",
    route: `/projects/${slug}/decisions/${id}`,
  });

  useAIElement({
    id: "decision-entity",
    type: "display",
    label: decision ? `Decision ${decision.id}` : "Decision",
    description: decision ? `${decision.type} decision, ${decision.status}` : undefined,
    data: decision ? {
      type: decision.type,
      status: decision.status,
      confidence: decision.confidence,
      task_id: decision.task_id,
      severity: decision.severity,
      likelihood: decision.likelihood,
    } : undefined,
    actions: [
      { label: "Close", toolName: "updateDecision", toolParams: ["id*", "status=CLOSED", "resolution_notes"], availableWhen: "status = OPEN" },
      { label: "Defer", toolName: "updateDecision", toolParams: ["id*", "status=DEFERRED"], availableWhen: "status = OPEN" },
      { label: "Mitigate", toolName: "updateDecision", toolParams: ["id*", "status=MITIGATED", "mitigation_plan"], availableWhen: "type = risk, status = ANALYZING" },
      { label: "Accept", toolName: "updateDecision", toolParams: ["id*", "status=ACCEPTED"], availableWhen: "type = risk, status = ANALYZING" },
    ],
  });

  const startEdit = () => {
    if (!decision) return;
    setEditTaskId(decision.task_id || "");
    setEditIssue(decision.issue);
    setEditRecommendation(decision.recommendation);
    setEditReasoning(decision.reasoning || "");
    setEditAlternatives([...decision.alternatives]);
    setEditConfidence(decision.confidence);
    setEditStatus(decision.status);
    setEditDecidedBy(decision.decided_by);
    setEditResolutionNotes(decision.resolution_notes || "");
    setEditFile(decision.file || "");
    setEditScope(decision.scope || "");
    setEditTags([...decision.tags]);
    setEditEvidenceRefs([...(decision.evidence_refs || [])]);
    setEditLinkedEntityType(decision.linked_entity_type || "");
    setEditLinkedEntityId(decision.linked_entity_id || "");
    setEditSeverity(decision.severity || "");
    setEditLikelihood(decision.likelihood || "");
    setEditMitigationPlan(decision.mitigation_plan || "");
    setEditExplorationType(decision.exploration_type || "");
    setEditOpenQuestions([...(decision.open_questions || [])]);
    setEditBlockers([...(decision.blockers || [])]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!decision) return;
    setSaving(true);
    setError(null);
    try {
      const update: DecisionUpdate = {};

      if (editTaskId !== (decision.task_id || "")) update.task_id = editTaskId;
      if (editIssue !== decision.issue) update.issue = editIssue;
      if (editRecommendation !== decision.recommendation) update.recommendation = editRecommendation;
      if (editReasoning !== (decision.reasoning || "")) update.reasoning = editReasoning;
      if (JSON.stringify(editAlternatives) !== JSON.stringify(decision.alternatives)) update.alternatives = editAlternatives;
      if (editConfidence !== decision.confidence) update.confidence = editConfidence as DecisionUpdate["confidence"];
      if (editStatus !== decision.status) update.status = editStatus as DecisionStatus;
      if (editDecidedBy !== decision.decided_by) update.decided_by = editDecidedBy as DecisionUpdate["decided_by"];
      if (editResolutionNotes !== (decision.resolution_notes || "")) update.resolution_notes = editResolutionNotes;
      if (editFile !== (decision.file || "")) update.file = editFile;
      if (editScope !== (decision.scope || "")) update.scope = editScope;
      if (JSON.stringify(editTags) !== JSON.stringify(decision.tags)) update.tags = editTags;
      if (JSON.stringify(editEvidenceRefs) !== JSON.stringify(decision.evidence_refs || [])) update.evidence_refs = editEvidenceRefs;
      if (editLinkedEntityType !== (decision.linked_entity_type || "")) update.linked_entity_type = editLinkedEntityType;
      if (editLinkedEntityId !== (decision.linked_entity_id || "")) update.linked_entity_id = editLinkedEntityId;

      // Risk-specific
      if (decision.type === "risk") {
        if (editSeverity !== (decision.severity || "")) update.severity = editSeverity;
        if (editLikelihood !== (decision.likelihood || "")) update.likelihood = editLikelihood;
        if (editMitigationPlan !== (decision.mitigation_plan || "")) update.mitigation_plan = editMitigationPlan;
      }
      // Exploration-specific
      if (decision.type === "exploration") {
        if (editExplorationType !== (decision.exploration_type || "")) update.exploration_type = editExplorationType;
        if (JSON.stringify(editOpenQuestions) !== JSON.stringify(decision.open_questions || [])) update.open_questions = editOpenQuestions;
        if (JSON.stringify(editBlockers) !== JSON.stringify(decision.blockers || [])) update.blockers = editBlockers;
      }

      if (Object.keys(update).length > 0) {
        const updated = await decisionsApi.update(slug, decision.id, update);
        setDecision(updated);
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!decision) return;
    setDeleting(true);
    try {
      await decisionsApi.remove(slug, decision.id);
      router.push(`/projects/${slug}/decisions`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Loading decision...</p>;
  if (error && !decision) return <p className="text-sm text-red-600">{error}</p>;
  if (!decision) return <p className="text-sm text-gray-400">Decision not found</p>;

  const isRisk = decision.type === "risk";
  const isExploration = decision.type === "exploration";
  const isClosed = decision.status === "CLOSED";
  const allowedStatuses = [decision.status, ...(STATUS_TRANSITIONS[decision.status] || [])];

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2">
            &larr; Back
          </button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-400 font-mono">{decision.id}</span>
                <Badge variant={statusVariant(decision.status)}>{decision.status}</Badge>
                <Badge>{decision.type}</Badge>
                <Badge variant={
                  decision.confidence === "HIGH" ? "success" :
                  decision.confidence === "LOW" ? "danger" : "warning"
                }>
                  {decision.confidence}
                </Badge>
              </div>
              {decision.task_id && (
                <div className="text-xs">
                  Task: <EntityLink id={decision.task_id} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!editing && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={startEdit}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
                </div>
              )}
              <div className="text-xs text-gray-400 text-right">
                <div>By: {decision.decided_by}</div>
                <div>Created: {new Date(decision.created_at).toLocaleDateString()}</div>
                {decision.updated_at && <div>Updated: {new Date(decision.updated_at).toLocaleDateString()}</div>}
              </div>
            </div>
          </div>
          {!editing && decision.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {decision.tags.map((t) => (
                <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600">Dismiss</button>
          </div>
        )}

        {editing ? (
          /* ===== Edit mode ===== */
          <div className="space-y-5 border rounded-lg p-5 bg-gray-50">
            {/* Core */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Core</legend>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue *</label>
                  <textarea
                    value={editIssue}
                    onChange={(e) => setEditIssue(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Recommendation *</label>
                  <textarea
                    value={editRecommendation}
                    onChange={(e) => setEditRecommendation(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reasoning</label>
                  <textarea
                    value={editReasoning}
                    onChange={(e) => setEditReasoning(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <EditableList
                  items={editAlternatives}
                  setItems={setEditAlternatives}
                  label="Alternatives"
                  addLabel="Add alternative"
                  rows={2}
                />
              </div>
            </fieldset>

            {/* Status & Classification */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status & Classification</legend>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={isClosed}
                    className="w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {allowedStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {isClosed && <p className="text-[10px] text-gray-400 mt-1">CLOSED is terminal</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confidence</label>
                  <select
                    value={editConfidence}
                    onChange={(e) => setEditConfidence(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Decided By</label>
                  <select
                    value={editDecidedBy}
                    onChange={(e) => setEditDecidedBy(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  >
                    <option value="claude">claude</option>
                    <option value="user">user</option>
                    <option value="imported">imported</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Risk Assessment */}
            {isRisk && (
              <fieldset>
                <legend className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Risk Assessment</legend>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value)}
                      className="w-full rounded-md border px-3 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Likelihood</label>
                    <select
                      value={editLikelihood}
                      onChange={(e) => setEditLikelihood(e.target.value)}
                      className="w-full rounded-md border px-3 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      <option value="certain">Certain</option>
                      <option value="likely">Likely</option>
                      <option value="possible">Possible</option>
                      <option value="unlikely">Unlikely</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mitigation Plan</label>
                  <textarea
                    value={editMitigationPlan}
                    onChange={(e) => setEditMitigationPlan(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </fieldset>
            )}

            {/* Exploration */}
            {isExploration && (
              <fieldset>
                <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Exploration</legend>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exploration Type</label>
                  <select
                    value={editExplorationType}
                    onChange={(e) => setEditExplorationType(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    <option value="domain">Domain</option>
                    <option value="architecture">Architecture</option>
                    <option value="business">Business</option>
                    <option value="risk">Risk</option>
                    <option value="feasibility">Feasibility</option>
                  </select>
                </div>
                <EditableList
                  items={editOpenQuestions}
                  setItems={setEditOpenQuestions}
                  label="Open Questions"
                  addLabel="Add question"
                />
                <div className="mt-3">
                  <EditableList
                    items={editBlockers}
                    setItems={setEditBlockers}
                    label="Blockers"
                    addLabel="Add blocker"
                  />
                </div>
                {decision.findings && decision.findings.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-2">Findings and Options are read-only here. Edit via CLI if needed.</p>
                )}
              </fieldset>
            )}

            {/* Linked Entity */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Entity</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Entity Type</label>
                  <select
                    value={editLinkedEntityType}
                    onChange={(e) => setEditLinkedEntityType(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  >
                    {ENTITY_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t || "— none —"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Entity ID</label>
                  <input
                    value={editLinkedEntityId}
                    onChange={(e) => setEditLinkedEntityId(e.target.value)}
                    placeholder="I-001, O-001, T-001..."
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </fieldset>

            {/* Context */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Context</legend>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Task ID</label>
                <input
                  value={editTaskId}
                  onChange={(e) => setEditTaskId(e.target.value)}
                  placeholder="T-001"
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                />
              </div>
            </fieldset>

            {/* Metadata */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metadata</legend>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                  <input
                    value={editFile}
                    onChange={(e) => setEditFile(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
                  <input
                    value={editScope}
                    onChange={(e) => setEditScope(e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <EditableList items={editTags} setItems={setEditTags} label="Tags" addLabel="Add tag" />
              <div className="mt-3">
                <EditableList items={editEvidenceRefs} setItems={setEditEvidenceRefs} label="Evidence Refs" addLabel="Add reference" />
              </div>
            </fieldset>

            {/* Resolution */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resolution</legend>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Resolution Notes</label>
                <textarea
                  value={editResolutionNotes}
                  onChange={(e) => setEditResolutionNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </fieldset>

            {/* Save / Cancel */}
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
          <div>
            {/* Issue */}
            <section className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Issue</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{decision.issue}</p>
            </section>

            {/* Recommendation */}
            {decision.recommendation && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommendation</h3>
                <div className="bg-forge-50 border border-forge-200 rounded-md p-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{decision.recommendation}</p>
                </div>
              </section>
            )}

            {/* Reasoning */}
            {decision.reasoning && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Reasoning</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{decision.reasoning}</p>
              </section>
            )}

            {/* Alternatives */}
            {decision.alternatives.length > 0 && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Alternatives ({decision.alternatives.length})
                </h3>
                <ul className="space-y-2">
                  {decision.alternatives.map((alt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span className="text-gray-600">{alt}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Linked Entity (generic — all types) */}
            {decision.linked_entity_id && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Linked Entity</h3>
                <div className="text-sm text-gray-600">
                  <span className="text-xs text-gray-400 mr-1">{decision.linked_entity_type}</span>
                  <EntityLink id={decision.linked_entity_id} />
                </div>
              </section>
            )}

            {/* Risk-specific fields */}
            {isRisk && <RiskSection decision={decision} />}

            {/* Exploration-specific fields */}
            {isExploration && <ExplorationSection decision={decision} />}

            {/* Resolution Notes */}
            {decision.resolution_notes && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Resolution Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-green-50 border border-green-200 rounded-md p-3">
                  {decision.resolution_notes}
                </p>
              </section>
            )}

            {/* Metadata */}
            <section className="border-t pt-4 mt-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-500">
                {decision.file && <div><span className="font-medium">File:</span> {decision.file}</div>}
                {decision.scope && <div><span className="font-medium">Scope:</span> {decision.scope}</div>}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Context sidebar — visible in both read and edit mode */}
      <ContextSidebar slug={slug} decision={decision} />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete ${decision.id}?`}
        description="This action cannot be undone. The decision and all its data will be permanently removed."
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Editable list helper (alternatives, tags, evidence refs, etc.)
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

/* ---------------------------------------------------------------------------
 * Risk section (read-only)
 * --------------------------------------------------------------------------- */

function RiskSection({ decision }: { decision: Decision }) {
  return (
    <section className="mb-6 border border-red-200 bg-red-50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-red-700 mb-3">Risk Assessment</h3>
      <div className="grid grid-cols-2 gap-4 mb-3">
        {decision.severity && (
          <div>
            <span className="text-xs text-gray-500 block">Severity</span>
            <Badge variant={
              decision.severity === "critical" ? "danger" :
              decision.severity === "high" ? "warning" : "default"
            }>
              {decision.severity}
            </Badge>
          </div>
        )}
        {decision.likelihood && (
          <div>
            <span className="text-xs text-gray-500 block">Likelihood</span>
            <Badge variant={
              decision.likelihood === "high" ? "danger" :
              decision.likelihood === "medium" ? "warning" : "default"
            }>
              {decision.likelihood}
            </Badge>
          </div>
        )}
      </div>
      {decision.mitigation_plan && (
        <div className="mb-2">
          <span className="text-xs font-medium text-gray-600 block mb-1">Mitigation Plan</span>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{decision.mitigation_plan}</p>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Context sidebar
 * --------------------------------------------------------------------------- */

function ContextSidebar({ slug, decision }: { slug: string; decision: Decision }) {
  const [task, setTask] = useState<Task | null>(null);
  const [originIdea, setOriginIdea] = useState<Idea | null>(null);
  const [objectiveIds, setObjectiveIds] = useState<string[]>([]);
  const [applicableGuidelines, setApplicableGuidelines] = useState<Guideline[]>([]);
  const [sourceSession, setSourceSession] = useState<ChatSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      // 1. Fetch related task
      let relatedTask: Task | null = null;
      if (decision.task_id) {
        try {
          relatedTask = await tasksApi.get(slug, decision.task_id);
          if (!cancelled) setTask(relatedTask);
        } catch { /* task may not exist */ }
      }

      // 2. Trace origin chain: task.origin → idea → objective KRs
      if (relatedTask?.origin && relatedTask.origin.startsWith("I-")) {
        try {
          const idea = await ideasApi.get(slug, relatedTask.origin);
          if (!cancelled) {
            setOriginIdea(idea);
            const objIds = Array.from(new Set(
              (idea.advances_key_results || [])
                .map((kr: string) => kr.split("/")[0])
                .filter((id: string) => id.startsWith("O-"))
            ));
            setObjectiveIds(objIds);
          }
        } catch { /* idea may not exist */ }
      }

      // 3. Load applicable guidelines from task scopes
      if (relatedTask?.scopes && relatedTask.scopes.length > 0) {
        try {
          const { guidelines: gl } = await guidelinesApi.list(slug, {
            scope: relatedTask.scopes.join(","),
          });
          if (!cancelled) setApplicableGuidelines(gl.slice(0, 10));
        } catch { /* ignore */ }
      }

      // 4. Find source LLM session (if AI-created)
      if (decision.decided_by === "claude") {
        try {
          const { sessions } = await llm.searchSessions(decision.id, 5);
          const match = sessions.find((s: ChatSession) =>
            s.project === slug
          );
          if (!cancelled && match) setSourceSession(match);
        } catch { /* sessions may not be searchable */ }
      }

      if (!cancelled) setLoaded(true);
    }

    loadContext();
    return () => { cancelled = true; };
  }, [slug, decision.task_id, decision.decided_by, decision.id]);

  return (
    <aside className="w-64 flex-shrink-0 space-y-5">
      {/* Source LLM session */}
      {decision.decided_by === "claude" && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Source
          </h3>
          {sourceSession ? (
            <Link
              href={`/sessions/${sourceSession.session_id}`}
              className="block text-xs text-indigo-600 hover:underline font-mono truncate"
            >
              Session {sourceSession.session_id.slice(0, 8)}...
            </Link>
          ) : loaded ? (
            <p className="text-[10px] text-gray-400">AI-created (session not found)</p>
          ) : (
            <p className="text-[10px] text-gray-400">Loading...</p>
          )}
        </section>
      )}

      {/* Related task */}
      {decision.task_id && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Related Task
          </h3>
          {task ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <EntityLink id={task.id} />
                <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
              </div>
              <p className="text-xs text-gray-600 line-clamp-3">{task.description || task.name}</p>
              {task.origin && (
                <div className="text-[10px] text-gray-400">
                  Origin: <EntityLink id={task.origin} />
                </div>
              )}
            </div>
          ) : loaded ? (
            <p className="text-[10px] text-gray-400">Task not found</p>
          ) : (
            <p className="text-[10px] text-gray-400">Loading...</p>
          )}
        </section>
      )}

      {/* Origin chain: Idea → Objective */}
      {originIdea && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Origin Idea
          </h3>
          <div className="space-y-1">
            <EntityLink id={originIdea.id} />
            <p className="text-xs text-gray-600 line-clamp-2">{originIdea.title}</p>
          </div>
        </section>
      )}

      {objectiveIds.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Objective{objectiveIds.length > 1 ? "s" : ""}
          </h3>
          <div className="space-y-1">
            {objectiveIds.map((oid) => (
              <div key={oid}>
                <EntityLink id={oid} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Applicable guidelines */}
      {applicableGuidelines.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Applicable Guidelines ({applicableGuidelines.length})
          </h3>
          <ul className="space-y-2">
            {applicableGuidelines.map((g) => (
              <li key={g.id}>
                <div className="flex items-center gap-1.5">
                  <EntityLink id={g.id} />
                  <Badge variant={g.weight === "must" ? "danger" : g.weight === "should" ? "warning" : "default"}>
                    {g.weight}
                  </Badge>
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-1">{g.title}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Evidence refs */}
      {decision.evidence_refs && decision.evidence_refs.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Evidence ({decision.evidence_refs.length})
          </h3>
          <ul className="space-y-1">
            {decision.evidence_refs.map((ref, i) => (
              <li key={i} className="text-xs text-gray-600 truncate" title={ref}>
                {ref}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

/* ---------------------------------------------------------------------------
 * Exploration section (read-only)
 * --------------------------------------------------------------------------- */

function ExplorationSection({ decision }: { decision: Decision }) {
  return (
    <section className="mb-6 border border-blue-200 bg-blue-50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-700 mb-3">
        Exploration {decision.exploration_type ? `(${decision.exploration_type})` : ""}
      </h3>

      {decision.findings && decision.findings.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-600 block mb-1">Findings</span>
          <ul className="space-y-1">
            {decision.findings.map((f, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400 shrink-0">-</span>
                <span>{typeof f === "string" ? f : JSON.stringify(f)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.options && decision.options.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-600 block mb-1">Options</span>
          <ul className="space-y-1">
            {decision.options.map((o, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400 shrink-0">{i + 1}.</span>
                <span>{typeof o === "string" ? o : JSON.stringify(o)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.open_questions && decision.open_questions.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-600 block mb-1">Open Questions</span>
          <ul className="space-y-1">
            {decision.open_questions.map((q, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-400 shrink-0">?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.blockers && decision.blockers.length > 0 && (
        <div>
          <span className="text-xs font-medium text-red-600 block mb-1">Blockers</span>
          <ul className="space-y-1">
            {decision.blockers.map((b, i) => (
              <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                <span className="shrink-0">!</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

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
import { EntityLink } from "@/components/shared/EntityLink";
import type { Decision, Task, Idea, Guideline, ChatSession } from "@/lib/types";

export default function DecisionDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string };
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <p className="text-sm text-gray-400">Loading decision...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!decision) return <p className="text-sm text-gray-400">Decision not found</p>;

  const isRisk = decision.type === "risk";
  const isExploration = decision.type === "exploration";

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
            <div className="text-xs text-gray-400 text-right">
              <div>By: {decision.decided_by}</div>
              <div>Created: {new Date(decision.created_at).toLocaleDateString()}</div>
              {decision.updated_at && <div>Updated: {new Date(decision.updated_at).toLocaleDateString()}</div>}
            </div>
          </div>
          {decision.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {decision.tags.map((t) => (
                <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>

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

      {/* Context sidebar */}
      <ContextSidebar slug={slug} decision={decision} />
    </div>
  );
}

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
      {decision.linked_entity_id && (
        <div className="text-xs text-gray-500">
          Linked entity: {decision.linked_entity_type}{" "}
          <EntityLink id={decision.linked_entity_id} />
        </div>
      )}
    </section>
  );
}

/** Context sidebar — lazy-loads related task, origin chain, session, guidelines. */
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
            // Extract objective IDs from advances_key_results (e.g., "O-001/KR-1" → "O-001")
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

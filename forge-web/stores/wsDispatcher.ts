/**
 * Centralized WebSocket event dispatcher.
 * Routes incoming ForgeEvents to the appropriate per-entity store
 * and triggers SWR cache revalidation.
 */
import { mutate } from "swr";
import type { ForgeEvent } from "@/lib/ws";
import { useTaskStore } from "./taskStore";
import { useDecisionStore } from "./decisionStore";
import { useObjectiveStore } from "./objectiveStore";
import { useIdeaStore } from "./ideaStore";
import { useChangeStore } from "./changeStore";
import { useGuidelineStore } from "./guidelineStore";
import { useKnowledgeStore } from "./knowledgeStore";
import { useLessonStore } from "./lessonStore";
import { useACTemplateStore } from "./acTemplateStore";
import { useGateStore } from "./gateStore";
import { isRecentMutation } from "@/lib/mutationTracker";

/** All stores that handle WS events, in dispatch order. */
const stores = [
  useTaskStore,
  useDecisionStore,
  useObjectiveStore,
  useIdeaStore,
  useChangeStore,
  useGuidelineStore,
  useKnowledgeStore,
  useLessonStore,
  useACTemplateStore,
  useGateStore,
] as const;

/** Maps WS event prefixes to API entity paths for SWR revalidation. */
const EVENT_TO_ENTITY: Record<string, string> = {
  task: "tasks",
  decision: "decisions",
  objective: "objectives",
  idea: "ideas",
  change: "changes",
  guideline: "guidelines",
  knowledge: "knowledge",
  lesson: "lessons",
  ac_template: "ac-templates",
  gate: "gates",
};

/**
 * Extract entity prefix and ID from a WS event.
 * e.g. "task.created" → { prefix: "task", entityId: payload.id }
 */
function parseEvent(event: ForgeEvent): { prefix: string; entityId?: string } {
  const prefix = event.event.split(".")[0];
  const payload = event.payload as Record<string, unknown>;
  const entityId = (payload.id ?? payload.task_id ?? payload.decision_id) as string | undefined;
  return { prefix, entityId };
}

/**
 * Dispatch a WebSocket event to all per-entity stores
 * and trigger SWR cache revalidation for the affected entity type.
 */
export function dispatchWsEvent(event: ForgeEvent): void {
  const { prefix, entityId } = parseEvent(event);

  // Skip SWR revalidation if this is an echo of our own mutation
  const skipSWR = entityId ? isRecentMutation(entityId) : false;

  // 1. Dispatch to Zustand stores (always — for optimistic update reconciliation)
  for (const store of stores) {
    store.getState().handleWsEvent(event);
  }

  // 2. Trigger SWR revalidation for entity lists (unless it's our own echo)
  if (!skipSWR) {
    const entityPath = EVENT_TO_ENTITY[prefix];
    if (entityPath && event.project) {
      // Revalidate all SWR keys matching this entity list pattern
      // mutate with key filter: any key containing /projects/{slug}/{entity}
      const pattern = `/projects/${event.project}/${entityPath}`;
      mutate(
        (key) => typeof key === "string" && key.startsWith(pattern),
        undefined,
        { revalidate: true },
      );
    }
  }
}

/** Track the last WS event timestamp (for connection status). */
let _lastEventTimestamp: string | null = null;

export function getLastEventTimestamp(): string | null {
  return _lastEventTimestamp;
}

export function setLastEventTimestamp(ts: string): void {
  _lastEventTimestamp = ts;
}

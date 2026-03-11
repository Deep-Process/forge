"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  knowledge as knowledgeApi,
  tasks as tasksApi,
} from "@/lib/api";
import type { KnowledgeLink, KnowledgeLinkRelation } from "@/lib/types";
import type { DropResult, DragData, DragEntityType } from "@/lib/hooks/useDragDrop";

/** Auto-dismiss wrapper: removes children after a delay. */
function AutoDismiss({ onDismiss, delay, children }: { onDismiss: () => void; delay: number; children: ReactNode }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, delay);
    return () => clearTimeout(t);
  }, [onDismiss, delay]);
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned after a relationship is built. */
export interface RelationshipResult {
  success: boolean;
  action: string;
  message: string;
  sourceId: string;
  targetId: string;
}

/** Callback invoked after the relationship builder processes a drop. */
export type OnRelationshipBuilt = (result: RelationshipResult) => void;

// ---------------------------------------------------------------------------
// Helpers — map entity types to knowledge link entity types
// ---------------------------------------------------------------------------

const ENTITY_TYPE_TO_LINK_TYPE: Record<string, KnowledgeLink["entity_type"] | undefined> = {
  tasks: "task",
  decisions: undefined,  // decisions not supported as knowledge link target
  ideas: "idea",
  objectives: "objective",
  knowledge: "knowledge",
  guidelines: "guideline",
  lessons: "lesson",
};

function toKnowledgeLinkEntityType(
  entityType: DragEntityType,
): KnowledgeLink["entity_type"] | null {
  return ENTITY_TYPE_TO_LINK_TYPE[entityType] ?? null;
}

// ---------------------------------------------------------------------------
// Core logic — determine and execute the post-drop action
// ---------------------------------------------------------------------------

/**
 * Create a knowledge link between a knowledge entity and another entity.
 */
async function createKnowledgeLink(
  slug: string,
  knowledgeId: string,
  linkedEntityType: KnowledgeLink["entity_type"],
  linkedEntityId: string,
  relation: KnowledgeLinkRelation = "references",
): Promise<RelationshipResult> {
  try {
    const linkData: KnowledgeLink = {
      entity_type: linkedEntityType,
      entity_id: linkedEntityId,
      relation,
    };
    await knowledgeApi.link(slug, knowledgeId, linkData);
    return {
      success: true,
      action: "create-link",
      message: `Linked ${linkedEntityType} ${linkedEntityId} to knowledge ${knowledgeId}`,
      sourceId: knowledgeId,
      targetId: linkedEntityId,
    };
  } catch (e) {
    return {
      success: false,
      action: "create-link",
      message: `Failed to link: ${(e as Error).message}`,
      sourceId: knowledgeId,
      targetId: linkedEntityId,
    };
  }
}

/**
 * Create a task dependency (source task depends on target task).
 */
async function createTaskDependency(
  slug: string,
  sourceTaskId: string,
  targetTaskId: string,
): Promise<RelationshipResult> {
  try {
    // Get current task to merge depends_on
    const task = await tasksApi.get(slug, sourceTaskId);
    const currentDeps = task.depends_on ?? [];
    if (currentDeps.includes(targetTaskId)) {
      return {
        success: true,
        action: "create-dependency",
        message: `${sourceTaskId} already depends on ${targetTaskId}`,
        sourceId: sourceTaskId,
        targetId: targetTaskId,
      };
    }
    await tasksApi.update(slug, sourceTaskId, {
      // TaskUpdate does not have depends_on in the strict type,
      // but the API accepts it — cast as needed
      ...({ depends_on: [...currentDeps, targetTaskId] } as Record<string, unknown>),
    } as never);
    return {
      success: true,
      action: "create-dependency",
      message: `${sourceTaskId} now depends on ${targetTaskId}`,
      sourceId: sourceTaskId,
      targetId: targetTaskId,
    };
  } catch (e) {
    return {
      success: false,
      action: "create-dependency",
      message: `Failed to create dependency: ${(e as Error).message}`,
      sourceId: sourceTaskId,
      targetId: targetTaskId,
    };
  }
}

/**
 * Process a "create-link" action between two entities.
 *
 * Uses the knowledge link API when one side is a knowledge entity.
 * For other entity combinations, returns a pending result that the
 * consumer can act on.
 */
async function handleCreateLink(
  slug: string,
  source: DragData,
  target: DragData,
): Promise<RelationshipResult> {
  // If source is knowledge, link target to it
  if (source.entityType === "knowledge") {
    const linkType = toKnowledgeLinkEntityType(target.entityType);
    if (linkType) {
      return createKnowledgeLink(slug, source.entityId, linkType, target.entityId);
    }
  }

  // If target is knowledge, link source to it
  if (target.entityType === "knowledge") {
    const linkType = toKnowledgeLinkEntityType(source.entityType);
    if (linkType) {
      return createKnowledgeLink(slug, target.entityId, linkType, source.entityId);
    }
  }

  // Generic link: return advisory result (consumer can implement further)
  return {
    success: true,
    action: "create-link",
    message: `Link requested: ${source.entityType}:${source.entityId} -> ${target.entityType}:${target.entityId}`,
    sourceId: source.entityId,
    targetId: target.entityId,
  };
}

/**
 * Process a drop result and execute the appropriate API calls.
 */
export async function processDropResult(
  slug: string,
  result: DropResult,
): Promise<RelationshipResult> {
  switch (result.action) {
    case "create-dependency": {
      const target = result.target as DragData;
      return createTaskDependency(slug, result.source.entityId, target.entityId);
    }

    case "create-link": {
      const target = result.target as DragData;
      return handleCreateLink(slug, result.source, target);
    }

    case "trigger-action": {
      const target = result.target as { zone: string };
      return {
        success: true,
        action: "trigger-action",
        message: `Action "${target.zone}" triggered for ${result.source.entityType}:${result.source.entityId}`,
        sourceId: result.source.entityId,
        targetId: target.zone,
      };
    }

    default:
      return {
        success: false,
        action: "unknown",
        message: "Unknown drop action",
        sourceId: result.source.entityId,
        targetId: "",
      };
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RelationshipBuilderProps {
  /** Current project slug. */
  slug: string;
  /** Callback after a relationship is built (or fails). */
  onResult?: OnRelationshipBuilt;
  /** Children receive the handleDrop function to wire into DropZones. */
  children: (handleDrop: (result: DropResult) => void) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Handles post-drop logic: determines what action to take based on
 * source entity type + target type (create link, create dependency,
 * trigger action) and calls the appropriate API methods.
 *
 * Renders as a render-prop component so consumers can wire `handleDrop`
 * into their DropZone instances.
 */
export function RelationshipBuilder({
  slug,
  onResult,
  children,
}: RelationshipBuilderProps) {
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<RelationshipResult | null>(null);

  const handleDrop = useCallback(
    async (dropResult: DropResult) => {
      setProcessing(true);
      setLastResult(null);
      try {
        const result = await processDropResult(slug, dropResult);
        setLastResult(result);
        onResult?.(result);
      } catch (e) {
        const errResult: RelationshipResult = {
          success: false,
          action: dropResult.action,
          message: (e as Error).message,
          sourceId: dropResult.source.entityId,
          targetId:
            "entityId" in (dropResult.target as DragData)
              ? (dropResult.target as DragData).entityId
              : (dropResult.target as { zone: string }).zone,
        };
        setLastResult(errResult);
        onResult?.(errResult);
      } finally {
        setProcessing(false);
      }
    },
    [slug, onResult],
  );

  return (
    <>
      {children(handleDrop)}
      {/* Toast-like feedback */}
      {processing && (
        <div className="fixed bottom-4 right-4 bg-forge-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 animate-pulse">
          Processing relationship...
        </div>
      )}
      {lastResult && !processing && (
        <AutoDismiss onDismiss={() => setLastResult(null)} delay={3000}>
          <div
            className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm z-50
              ${lastResult.success ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
          >
            {lastResult.message}
          </div>
        </AutoDismiss>
      )}
    </>
  );
}

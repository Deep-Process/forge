"use client";

import { useState, useCallback, useRef } from "react";
import type { EntityType } from "@/stores/entityStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The entity types that can participate in drag-and-drop. */
export type DragEntityType = Exclude<EntityType, "acTemplates" | "gates" | "changes">;

/** Data transferred during a drag operation. */
export interface DragData {
  /** Entity type (e.g. "tasks", "knowledge"). */
  entityType: DragEntityType;
  /** Entity ID (e.g. "T-001", "K-003"). */
  entityId: string;
  /** Optional display label. */
  label?: string;
}

/** Actions that can result from a drop. */
export type DropAction = "create-link" | "create-dependency" | "trigger-action";

/** Describes the outcome of a drop interaction. */
export interface DropResult {
  action: DropAction;
  source: DragData;
  target: DragData | { zone: string };
}

/** Callback invoked when a valid drop occurs. */
export type OnDropHandler = (result: DropResult) => void;

// ---------------------------------------------------------------------------
// Interaction matrix (Section 9.2)
// ---------------------------------------------------------------------------

/**
 * Determines what action to take when `source` is dropped on `target`.
 * Returns null if the combination is not allowed.
 */
export function resolveDropAction(
  sourceType: DragEntityType,
  targetType: DragEntityType | "zone",
): DropAction | null {
  // Entity dropped on a zone
  if (targetType === "zone") return "trigger-action";

  // Task on Task = dependency
  if (sourceType === "tasks" && targetType === "tasks") return "create-dependency";

  // Entity on Entity = create link (various combinations)
  const linkablePairs: Array<[DragEntityType, DragEntityType]> = [
    ["knowledge", "tasks"],
    ["tasks", "knowledge"],
    ["guidelines", "objectives"],
    ["objectives", "guidelines"],
    ["knowledge", "objectives"],
    ["objectives", "knowledge"],
    ["knowledge", "guidelines"],
    ["guidelines", "knowledge"],
    ["ideas", "tasks"],
    ["tasks", "ideas"],
    ["ideas", "objectives"],
    ["objectives", "ideas"],
    ["knowledge", "ideas"],
    ["ideas", "knowledge"],
    ["lessons", "tasks"],
    ["tasks", "lessons"],
    ["lessons", "knowledge"],
    ["knowledge", "lessons"],
    ["guidelines", "tasks"],
    ["tasks", "guidelines"],
    ["decisions", "tasks"],
    ["tasks", "decisions"],
    ["decisions", "knowledge"],
    ["knowledge", "decisions"],
    ["lessons", "guidelines"],
    ["guidelines", "lessons"],
  ];

  const isLinkable = linkablePairs.some(
    ([a, b]) => a === sourceType && b === targetType,
  );
  if (isLinkable) return "create-link";

  return null;
}

/**
 * Returns the set of entity types that are valid drop targets for a given source type.
 */
export function getValidTargets(sourceType: DragEntityType): Set<DragEntityType | "zone"> {
  const valid = new Set<DragEntityType | "zone">();
  const allTypes: DragEntityType[] = [
    "tasks", "decisions", "objectives", "ideas", "guidelines", "knowledge", "lessons",
  ];
  for (const t of allTypes) {
    if (resolveDropAction(sourceType, t) !== null) {
      valid.add(t);
    }
  }
  // Zones are always valid targets
  valid.add("zone");
  return valid;
}

// ---------------------------------------------------------------------------
// MIME type constant for dataTransfer
// ---------------------------------------------------------------------------

export const DND_MIME = "application/x-forge-dnd";

/** Serialize drag data for dataTransfer. */
export function serializeDragData(data: DragData): string {
  return JSON.stringify(data);
}

/** Deserialize drag data from dataTransfer. Returns null on failure. */
export function parseDragData(raw: string): DragData | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.entityType === "string" && typeof parsed.entityId === "string") {
      return parsed as DragData;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseDragDropState {
  /** Whether a drag is currently active. */
  isDragging: boolean;
  /** Data about the item currently being dragged. */
  currentDrag: DragData | null;
  /** Set of entity types that are valid drop targets for the current drag. */
  validTargets: Set<DragEntityType | "zone">;
  /** Start a drag operation (called from DragItem's onDragStart). */
  startDrag: (data: DragData) => void;
  /** End the drag operation (called from onDragEnd). */
  endDrag: () => void;
  /** Check whether a given entity type is a valid drop target right now. */
  isValidTarget: (targetType: DragEntityType | "zone") => boolean;
}

/**
 * Hook to manage DnD state across components.
 *
 * Tracks which item is being dragged and computes valid drop targets
 * based on the interaction matrix.
 */
export function useDragDrop(): UseDragDropState {
  const [isDragging, setIsDragging] = useState(false);
  const [currentDrag, setCurrentDrag] = useState<DragData | null>(null);
  const [validTargets, setValidTargets] = useState<Set<DragEntityType | "zone">>(new Set());

  // Use ref for synchronous reads during drag events
  const currentDragRef = useRef<DragData | null>(null);

  const startDrag = useCallback((data: DragData) => {
    currentDragRef.current = data;
    setCurrentDrag(data);
    setIsDragging(true);
    setValidTargets(getValidTargets(data.entityType));
  }, []);

  const endDrag = useCallback(() => {
    currentDragRef.current = null;
    setCurrentDrag(null);
    setIsDragging(false);
    setValidTargets(new Set());
  }, []);

  const isValidTarget = useCallback(
    (targetType: DragEntityType | "zone") => validTargets.has(targetType),
    [validTargets],
  );

  return {
    isDragging,
    currentDrag,
    validTargets,
    startDrag,
    endDrag,
    isValidTarget,
  };
}

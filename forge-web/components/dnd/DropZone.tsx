"use client";

import {
  useState,
  useCallback,
  type ReactNode,
  type DragEvent,
} from "react";
import {
  DND_MIME,
  parseDragData,
  resolveDropAction,
  type DragData,
  type DragEntityType,
  type DropResult,
} from "@/lib/hooks/useDragDrop";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DropZoneEntityTarget {
  kind: "entity";
  /** The entity type this zone accepts. */
  entityType: DragEntityType;
  /** The specific entity id this zone represents (e.g. a card being dropped onto). */
  entityId: string;
}

interface DropZoneActionTarget {
  kind: "zone";
  /** Name of the zone action (e.g. "delete", "archive", "assign"). */
  zone: string;
}

type DropTarget = DropZoneEntityTarget | DropZoneActionTarget;

interface DropZoneProps {
  /** Describes what this zone represents as a drop target. */
  target: DropTarget;
  /** Callback when a valid drop occurs. */
  onDrop: (result: DropResult) => void;
  /** Whether the zone is currently a valid target (from useDragDrop.isValidTarget). */
  isActive?: boolean;
  /** Extra CSS classes for the wrapper div. */
  className?: string;
  /** Content to render inside the drop zone. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A drop target area that highlights on dragOver and calls onDrop with
 * structured entity data.
 *
 * Validates the drop against the interaction matrix before accepting.
 * Shows visual feedback (border highlight + background tint) when a
 * dragged item hovers over a valid target.
 */
export function DropZone({
  target,
  onDrop,
  isActive = true,
  className = "",
  children,
}: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  // Validate whether the dragged entity can be dropped here
  const validate = useCallback(
    (source: DragData): boolean => {
      if (target.kind === "zone") {
        return resolveDropAction(source.entityType, "zone") !== null;
      }
      // Prevent dropping an entity onto itself
      if (
        source.entityType === target.entityType &&
        source.entityId === target.entityId
      ) {
        return false;
      }
      return resolveDropAction(source.entityType, target.entityType) !== null;
    },
    [target],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // Must prevent default to allow dropping
      if (!isActive) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "link";
      setIsOver(true);
    },
    [isActive],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isActive) return;
      e.preventDefault();
      setIsOver(true);
    },
    [isActive],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // Only react when leaving the zone itself, not child elements
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsOver(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);

      if (!isActive) return;

      const raw = e.dataTransfer.getData(DND_MIME);
      if (!raw) return;

      const source = parseDragData(raw);
      if (!source) return;

      if (!validate(source)) return;

      if (target.kind === "zone") {
        onDrop({
          action: "trigger-action",
          source,
          target: { zone: target.zone },
        });
      } else {
        const action = resolveDropAction(source.entityType, target.entityType);
        if (!action) return;
        onDrop({
          action,
          source,
          target: {
            entityType: target.entityType,
            entityId: target.entityId,
          },
        });
      }
    },
    [isActive, target, onDrop, validate],
  );

  const highlight = isActive && isOver;

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative transition-colors duration-150 rounded-lg
        ${highlight ? "ring-2 ring-forge-400 bg-forge-50/60" : ""}
        ${isActive ? "" : "opacity-50 pointer-events-none"}
        ${className}`}
      aria-dropeffect={isActive ? "link" : "none"}
    >
      {children}
      {highlight && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-forge-400 pointer-events-none" />
      )}
    </div>
  );
}

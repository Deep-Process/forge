"use client";

import { useCallback, type ReactNode, type DragEvent } from "react";
import {
  DND_MIME,
  serializeDragData,
  type DragData,
} from "@/lib/hooks/useDragDrop";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DragItemProps {
  /** Drag payload — entity type + id. */
  data: DragData;
  /** Called when drag starts (hook into useDragDrop.startDrag). */
  onDragStart?: (data: DragData) => void;
  /** Called when drag ends (hook into useDragDrop.endDrag). */
  onDragEnd?: () => void;
  /** Extra CSS classes for the wrapper div. */
  className?: string;
  /** Content to render inside the draggable wrapper. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Wrapper that makes any child element draggable.
 *
 * Sets the HTML5 `draggable` attribute and populates `dataTransfer`
 * with serialized entity data (type + id) using a custom MIME type.
 *
 * During a drag the wrapper gets a reduced opacity to signal that
 * the item is being moved.
 */
export function DragItem({
  data,
  onDragStart,
  onDragEnd,
  className = "",
  children,
}: DragItemProps) {
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // Set custom MIME data so DropZone can deserialize
      e.dataTransfer.setData(DND_MIME, serializeDragData(data));
      // Also set plain text for accessibility / external consumers
      e.dataTransfer.setData(
        "text/plain",
        `${data.entityType}:${data.entityId}`,
      );
      e.dataTransfer.effectAllowed = "linkMove";

      onDragStart?.(data);
    },
    [data, onDragStart],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`cursor-grab active:cursor-grabbing select-none transition-opacity
        [&.dragging]:opacity-40 ${className}`}
      aria-roledescription="draggable item"
      aria-label={data.label ?? `${data.entityType} ${data.entityId}`}
    >
      {children}
    </div>
  );
}

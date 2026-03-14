"use client";

import { useState } from "react";
import { Button } from "./Button";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface BulkActionBarProps {
  count: number;
  entityLabel?: string;
  onDelete: () => Promise<void>;
  onDeselectAll: () => void;
}

export function BulkActionBar({
  count,
  entityLabel = "items",
  onDelete,
  onDeselectAll,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (count === 0) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
      onDeselectAll();
    } catch {
      // errors handled by caller via toast
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 mb-3">
        <span className="text-sm font-medium text-blue-700">
          {count} selected
        </span>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Selected
        </Button>
        <button
          onClick={onDeselectAll}
          className="text-xs text-blue-500 hover:text-blue-700 hover:underline ml-auto"
        >
          Deselect All
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        title={`Delete ${count} ${entityLabel}?`}
        description="This action cannot be undone."
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </>
  );
}

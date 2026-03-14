"use client";

import { useEffect, useCallback, useRef } from "react";
import { Button } from "./Button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    },
    [onCancel, loading],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Focus cancel button on open
  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={() => !loading && onCancel()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
          className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        >
          <h3 id="confirm-delete-title" className="text-sm font-semibold text-gray-900 mb-1">
            {title}
          </h3>
          {description && (
            <p id="confirm-delete-desc" className="text-xs text-gray-500 mb-4">
              {description}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              ref={cancelRef}
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

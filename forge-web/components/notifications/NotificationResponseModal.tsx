"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNotificationModal } from "./useNotificationModal";
import { NOTIFICATION_RENDERERS } from "./registry";
import { respondToNotification, dismissNotification } from "@/stores/notificationEntityStore";
import type { NotificationPriority } from "@/lib/types";

const PRIORITY_BADGE: Record<NotificationPriority, { style: string; label: string }> = {
  critical: { style: "bg-red-100 text-red-700", label: "Critical" },
  high: { style: "bg-orange-100 text-orange-700", label: "High" },
  normal: { style: "bg-blue-100 text-blue-700", label: "Normal" },
  low: { style: "bg-gray-100 text-gray-500", label: "Low" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Base modal for notification responses.
 * Uses pluggable content from NOTIFICATION_RENDERERS registry.
 * Falls back to a generic text response form if no renderer is registered.
 */
export function NotificationResponseModal() {
  const { notification, close } = useNotificationModal();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  if (!notification || !slug) return null;

  const prioConf = PRIORITY_BADGE[notification.priority] ?? PRIORITY_BADGE.normal;
  const Renderer = NOTIFICATION_RENDERERS.get(notification.notification_type);

  const handleRespond = async (text: string, action?: string) => {
    setLoading(true);
    try {
      await respondToNotification(slug, notification.id, { response: text, action });
      close();
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await dismissNotification(slug, notification.id);
      close();
    } finally {
      setLoading(false);
    }
  };

  const handleGenericSubmit = () => {
    if (response.trim()) {
      handleRespond(response.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioConf.style}`}>
              {prioConf.label}
            </span>
            <h2 className="font-semibold text-sm text-gray-800 line-clamp-1">
              {notification.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">
              {relativeTime(notification.created_at)}
            </span>
            <button
              onClick={close}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content slot */}
        <div className="p-4">
          {Renderer ? (
            <Renderer
              notification={notification}
              onRespond={handleRespond}
              onDismiss={handleDismiss}
              loading={loading}
            />
          ) : (
            /* Generic fallback */
            <div className="space-y-3">
              {notification.message && (
                <p className="text-sm text-gray-600">{notification.message}</p>
              )}

              {/* AI options */}
              {notification.ai_options.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Suggested actions:</p>
                  {notification.ai_options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleRespond(opt.label, opt.action)}
                      disabled={loading}
                      className="w-full text-left p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-800">{opt.label}</span>
                      {opt.reasoning && (
                        <p className="text-xs text-gray-500 mt-0.5">{opt.reasoning}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Free text response */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Your response
                </label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Type your response..."
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Actions slot */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleDismiss}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleGenericSubmit}
                  disabled={loading || !response.trim()}
                  className="px-4 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Respond"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Source info */}
        {notification.source_entity_id && (
          <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
            Source: {notification.source_entity_type} {notification.source_entity_id}
            {notification.workflow_id && ` | Workflow: ${notification.workflow_id}`}
          </div>
        )}
      </div>
    </div>
  );
}

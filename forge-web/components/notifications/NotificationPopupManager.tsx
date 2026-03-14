"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useNotificationModal } from "./useNotificationModal";
import type { Notification } from "@/lib/types";

/**
 * Bridge component that migrates the old DecisionNotificationPopup behavior
 * to the new unified NotificationResponseModal system.
 *
 * Watches the old notificationStore queue and opens the new modal
 * for each queued notification.
 */
export function NotificationPopupManager() {
  const decisions = useNotificationStore((s) => s.decisions);
  const removeDecision = useNotificationStore((s) => s.removeDecision);
  const modalNotification = useNotificationModal((s) => s.notification);
  const openModal = useNotificationModal((s) => s.open);

  // When a notification is queued and the modal is not already open, open it
  useEffect(() => {
    if (decisions.length === 0 || modalNotification !== null) return;

    const current = decisions[0];
    // Convert old DecisionNotification to new Notification shape
    const notification: Notification = {
      id: current.id,
      notification_type: current.type === "risk" ? "alert" : "decision",
      priority: (current.severity as Notification["priority"]) ?? "normal",
      status: "UNREAD",
      title: current.issue,
      message: "",
      source_event: "decision.created",
      source_entity_type: "decision",
      source_entity_id: current.decisionId,
      project: current.project ?? "",
      workflow_id: "",
      workflow_step: "",
      ai_options: [],
      response: null,
      response_at: null,
      created_at: new Date(current.createdAt).toISOString(),
      resolved_at: null,
    };

    openModal(notification);
    removeDecision(current.id);
  }, [decisions, modalNotification, openModal, removeDecision]);

  return null; // No visual output — purely behavioral
}

import type { ComponentType } from "react";
import type { Notification } from "@/lib/types";

/**
 * Props passed to notification type-specific renderers.
 * Each renderer provides the content + actions for its notification type.
 */
export interface NotificationRendererProps {
  notification: Notification;
  onRespond: (response: string, action?: string) => Promise<void>;
  onDismiss: () => Promise<void>;
  loading: boolean;
}

/**
 * Registry of notification type renderers (D-016: pluggable content slots).
 * Each notification_type maps to a React component that renders the detail view.
 * New types can be added by registering a renderer here.
 */
export const NOTIFICATION_RENDERERS = new Map<
  string,
  ComponentType<NotificationRendererProps>
>();

/**
 * Register a renderer for a notification type.
 */
export function registerRenderer(
  type: string,
  component: ComponentType<NotificationRendererProps>,
): void {
  NOTIFICATION_RENDERERS.set(type, component);
}

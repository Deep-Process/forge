"use client";

import { create } from "zustand";
import type { Notification } from "@/lib/types";

interface NotificationModalState {
  notification: Notification | null;
  open: (n: Notification) => void;
  close: () => void;
}

export const useNotificationModal = create<NotificationModalState>((set) => ({
  notification: null,
  open: (n) => set({ notification: n }),
  close: () => set({ notification: null }),
}));

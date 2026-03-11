import { create } from "zustand";

export type PanelState = "collapsed" | "expanded" | "fullscreen";
export type DebugTab = "api" | "llm" | "events";

interface DebugPanelState {
  panelState: PanelState;
  activeTab: DebugTab;
  errorCount: number;
  eventCount: number;

  toggle: () => void;
  setPanelState: (state: PanelState) => void;
  setActiveTab: (tab: DebugTab) => void;
  incrementErrors: () => void;
  incrementEvents: () => void;
  resetCounts: () => void;
}

export const useDebugPanelStore = create<DebugPanelState>((set, get) => ({
  panelState: "collapsed",
  activeTab: "api",
  errorCount: 0,
  eventCount: 0,

  toggle: () => {
    const current = get().panelState;
    set({ panelState: current === "collapsed" ? "expanded" : "collapsed" });
  },

  setPanelState: (panelState) => set({ panelState }),

  setActiveTab: (activeTab) => set({ activeTab }),

  incrementErrors: () => set((s) => ({ errorCount: s.errorCount + 1 })),
  incrementEvents: () => set((s) => ({ eventCount: s.eventCount + 1 })),
  resetCounts: () => set({ errorCount: 0, eventCount: 0 }),
}));

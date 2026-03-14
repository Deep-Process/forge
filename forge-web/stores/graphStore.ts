/**
 * Graph UI state store — filters, viewport, selection.
 * Does NOT hold node/edge data (that comes from SWR via Graph API).
 */
import { create } from "zustand";

const ALL_ENTITY_TYPES = [
  "objective",
  "idea",
  "task",
  "decision",
  "research",
  "knowledge",
  "guideline",
  "lesson",
  "ac_template",
] as const;

export type EntityType = (typeof ALL_ENTITY_TYPES)[number];

interface GraphState {
  // Filters
  selectedTypes: EntityType[];
  statusFilter: string | null; // null = show all
  edgeTypeFilter: string[]; // which edge types to show

  // Selection
  selectedNodeId: string | null;

  // Actions
  toggleType: (type: EntityType) => void;
  setAllTypes: (types: EntityType[]) => void;
  setStatusFilter: (status: string | null) => void;
  setEdgeTypeFilter: (types: string[]) => void;
  setSelectedNode: (id: string | null) => void;
  resetFilters: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  selectedTypes: [...ALL_ENTITY_TYPES],
  statusFilter: null,
  edgeTypeFilter: ["depends_on", "advances_kr", "origin", "derived_from"],
  selectedNodeId: null,

  toggleType: (type) =>
    set((s) => ({
      selectedTypes: s.selectedTypes.includes(type)
        ? s.selectedTypes.filter((t) => t !== type)
        : [...s.selectedTypes, type],
    })),

  setAllTypes: (types) => set({ selectedTypes: types }),

  setStatusFilter: (status) => set({ statusFilter: status }),

  setEdgeTypeFilter: (types) => set({ edgeTypeFilter: types }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  resetFilters: () =>
    set({
      selectedTypes: [...ALL_ENTITY_TYPES],
      statusFilter: null,
      edgeTypeFilter: ["depends_on", "advances_kr", "origin", "derived_from"],
      selectedNodeId: null,
    }),
}));

export { ALL_ENTITY_TYPES };

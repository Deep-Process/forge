import { createEntityStore, withCreateLoading, withUpdate } from "./factory";
import { research as researchApi } from "@/lib/api";
import type { Research, ResearchCreate, ResearchUpdate } from "@/lib/types";

export const useResearchStore = createEntityStore<Research>({
  listFn: (s, p) => researchApi.list(s, p),
  responseKey: "research",
  getItemId: (item) => item.id,
  wsEvents: {
    "research.created": { op: "create", idKey: "research_id" },
    "research.updated": { op: "update", idKey: "research_id" },
  },
});

export async function createResearch(slug: string, data: ResearchCreate[]): Promise<string[]> {
  return withCreateLoading(useResearchStore, () => researchApi.create(slug, data), { slug, entityPath: "research" });
}

export async function updateResearch(slug: string, id: string, data: ResearchUpdate): Promise<void> {
  return withUpdate(useResearchStore, (item) => item.id, id, () => researchApi.update(slug, id, data), data, { slug, entityPath: "research" });
}

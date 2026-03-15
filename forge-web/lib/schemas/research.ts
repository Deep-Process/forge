import { z } from "zod";

const researchCategory = z.enum([
  "architecture", "business", "domain", "feasibility", "risk", "technical",
]);
const researchStatus = z.enum(["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"]);

export const researchCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  category: researchCategory,
  summary: z.string().min(1, "Summary is required"),
  linked_entity_type: z.enum(["objective", "idea"]).optional(),
  linked_entity_id: z.string().optional(),
  linked_idea_id: z.string().optional(),
  content: z.string().optional(),
  key_findings: z.array(z.string()).optional(),
  decision_ids: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  created_by: z.string().optional(),
});

export const researchUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  status: researchStatus.optional(),
  category: researchCategory.optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  key_findings: z.array(z.string()).optional(),
  decision_ids: z.array(z.string()).optional(),
  file_path: z.string().optional(),
  linked_entity_type: z.enum(["objective", "idea"]).optional(),
  linked_entity_id: z.string().optional(),
  linked_idea_id: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ResearchCreateForm = z.infer<typeof researchCreateSchema>;
export type ResearchUpdateForm = z.infer<typeof researchUpdateSchema>;

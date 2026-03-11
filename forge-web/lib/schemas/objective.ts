import { z } from "zod";

const objectiveStatus = z.enum(["ACTIVE", "ACHIEVED", "ABANDONED", "PAUSED"]);
const krStatus = z.enum(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED"]);
const relationType = z.enum(["depends_on", "related_to", "supersedes", "duplicates"]);

export const keyResultSchema = z.object({
  metric: z.string().min(1).optional(),
  baseline: z.number().optional(),
  target: z.number().optional(),
  current: z.number().optional(),
  description: z.string().min(1).optional(),
  status: krStatus.optional(),
}).refine(
  (kr) => Boolean(kr.metric && kr.target !== undefined) || Boolean(kr.description),
  { message: "Key result must have either (metric + target) or description" }
);

export const objectiveRelationSchema = z.object({
  type: relationType,
  target_id: z.string().regex(/^O-\d{3}$/, "Must be O-NNN format"),
  notes: z.string().optional(),
});

export const objectiveCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  key_results: z.array(keyResultSchema).min(1, "At least one key result is required"),
  appetite: z.enum(["small", "medium", "large"]),
  scope: z.enum(["project", "cross-project"]),
  assumptions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  derived_guidelines: z.array(z.string()).optional(),
  knowledge_ids: z.array(z.string()).optional(),
  guideline_ids: z.array(z.string()).optional(),
  relations: z.array(objectiveRelationSchema).optional(),
});

export const objectiveUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: objectiveStatus.optional(),
  appetite: z.enum(["small", "medium", "large"]).optional(),
  assumptions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  key_results: z.array(keyResultSchema).optional(),
  scopes: z.array(z.string()).optional(),
  derived_guidelines: z.array(z.string()).optional(),
  knowledge_ids: z.array(z.string()).optional(),
  guideline_ids: z.array(z.string()).optional(),
  relations: z.array(objectiveRelationSchema).optional(),
});

export type KeyResultForm = z.infer<typeof keyResultSchema>;
export type ObjectiveRelationForm = z.infer<typeof objectiveRelationSchema>;
export type ObjectiveCreateForm = z.infer<typeof objectiveCreateSchema>;
export type ObjectiveUpdateForm = z.infer<typeof objectiveUpdateSchema>;

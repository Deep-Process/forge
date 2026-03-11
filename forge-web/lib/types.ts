/**
 * TypeScript types for all Forge API entities.
 * Matches the Pydantic models in forge-api/app/routers/*.py.
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "FAILED" | "SKIPPED" | "CLAIMING";
export type TaskType = "feature" | "bug" | "chore" | "investigation";
export type DecisionType =
  | "architecture" | "implementation" | "dependency" | "security"
  | "performance" | "testing" | "naming" | "convention" | "constraint"
  | "business" | "strategy" | "other" | "exploration" | "risk";
export type DecisionStatus = "OPEN" | "CLOSED" | "DEFERRED" | "ANALYZING" | "MITIGATED" | "ACCEPTED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type IdeaStatus = "DRAFT" | "EXPLORING" | "APPROVED" | "REJECTED" | "COMMITTED";
export type IdeaCategory =
  | "feature" | "improvement" | "experiment" | "migration"
  | "refactor" | "infrastructure" | "business-opportunity" | "research";
export type GuidelineWeight = "must" | "should" | "may";
export type GuidelineStatus = "ACTIVE" | "DEPRECATED";
export type KnowledgeStatus = "DRAFT" | "ACTIVE" | "REVIEW_NEEDED" | "DEPRECATED" | "ARCHIVED";
export type KnowledgeCategory =
  | "domain-rules" | "api-reference" | "architecture" | "business-context"
  | "technical-context" | "code-patterns" | "integration" | "infrastructure";
export type LessonCategory =
  | "pattern-discovered" | "mistake-avoided" | "decision-validated"
  | "decision-reversed" | "tool-insight" | "architecture-lesson"
  | "process-improvement" | "market-insight";
export type LessonSeverity = "critical" | "important" | "minor";
export type ChangeAction = "create" | "edit" | "delete" | "rename" | "move" | "verify";
export type ObjectiveStatus = "ACTIVE" | "ACHIEVED" | "ABANDONED" | "PAUSED";
export type ACTemplateCategory =
  | "performance" | "security" | "quality" | "functionality"
  | "accessibility" | "reliability" | "data-integrity" | "ux";
export type KnowledgeLinkEntityType =
  | "task" | "idea" | "objective" | "knowledge" | "guideline" | "lesson";
export type KnowledgeLinkRelation =
  | "required" | "context" | "reference" | "depends_on"
  | "references" | "derived-from" | "supports" | "contradicts";

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectDetail {
  project: string;
  goal: string;
  config: Record<string, unknown>;
  created: string;
  updated: string;
  task_count: number;
}

export interface ProjectCreate {
  slug: string;
  goal: string;
  config?: Record<string, unknown>;
}

export interface ProjectStatus {
  project: string;
  goal: string;
  total_tasks: number;
  progress_pct: number;
  status_counts: Record<string, number>;
  blockers: Array<{ id: string; name: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  name: string;
  description: string;
  instruction: string;
  type: TaskType;
  status: TaskStatus;
  depends_on: string[];
  blocked_by_decisions: string[];
  conflicts_with: string[];
  acceptance_criteria: string[];
  scopes: string[];
  parallel: boolean;
  skill: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_reason: string | null;
  agent?: string;
}

export interface TaskCreate {
  name: string;
  description?: string;
  instruction?: string;
  type?: TaskType;
  depends_on?: string[];
  blocked_by_decisions?: string[];
  conflicts_with?: string[];
  acceptance_criteria?: string[];
  scopes?: string[];
  parallel?: boolean;
  skill?: string | null;
}

export interface TaskUpdate {
  name?: string;
  description?: string;
  instruction?: string;
  status?: TaskStatus;
  failed_reason?: string;
  blocked_by_decisions?: string[];
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export interface Decision {
  id: string;
  task_id: string;
  type: DecisionType;
  issue: string;
  recommendation: string;
  reasoning: string;
  alternatives: string[];
  confidence: Confidence;
  status: DecisionStatus;
  decided_by: "claude" | "user" | "imported";
  file: string;
  scope: string;
  tags: string[];
  exploration_type?: string;
  findings?: unknown[];
  options?: unknown[];
  open_questions?: string[];
  blockers?: string[];
  ready_for_tracker?: boolean;
  evidence_refs?: string[];
  severity?: string;
  likelihood?: string;
  mitigation_plan?: string;
  resolution_notes?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface DecisionCreate {
  task_id: string;
  type?: DecisionType;
  issue: string;
  recommendation: string;
  reasoning?: string;
  alternatives?: string[];
  confidence?: Confidence;
  status?: DecisionStatus;
  decided_by?: "claude" | "user" | "imported";
  file?: string;
  scope?: string;
  tags?: string[];
  exploration_type?: string;
  findings?: unknown[];
  options?: unknown[];
  open_questions?: string[];
  blockers?: string[];
  ready_for_tracker?: boolean;
  evidence_refs?: string[];
  severity?: string;
  likelihood?: string;
  mitigation_plan?: string;
  resolution_notes?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
}

export interface DecisionUpdate {
  status?: DecisionStatus;
  recommendation?: string;
  reasoning?: string;
  decided_by?: "claude" | "user" | "imported";
  resolution_notes?: string;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export interface KeyResult {
  metric: string;
  baseline?: number;
  target: number;
  current?: number;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  key_results: KeyResult[];
  appetite: "small" | "medium" | "large";
  scope: "project" | "cross-project";
  assumptions: string[];
  tags: string[];
  scopes: string[];
  derived_guidelines: string[];
  knowledge_ids: string[];
  status: ObjectiveStatus;
  created_at: string;
}

export interface ObjectiveCreate {
  title: string;
  description: string;
  key_results: KeyResult[];
  appetite?: "small" | "medium" | "large";
  scope?: "project" | "cross-project";
  assumptions?: string[];
  tags?: string[];
  scopes?: string[];
  derived_guidelines?: string[];
  knowledge_ids?: string[];
}

export interface ObjectiveUpdate {
  title?: string;
  description?: string;
  status?: ObjectiveStatus;
  appetite?: "small" | "medium" | "large";
  assumptions?: string[];
  tags?: string[];
  key_results?: KeyResult[];
  scopes?: string[];
  derived_guidelines?: string[];
  knowledge_ids?: string[];
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: IdeaCategory;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: IdeaStatus;
  tags: string[];
  parent_id: string | null;
  related_ideas: string[];
  guidelines: string[];
  relations: Array<Record<string, unknown>>;
  scopes: string[];
  advances_key_results: string[];
  knowledge_ids: string[];
  created_at: string;
}

export interface IdeaCreate {
  title: string;
  description?: string;
  category?: IdeaCategory;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  tags?: string[];
  parent_id?: string;
  related_ideas?: string[];
  guidelines?: string[];
  relations?: Array<Record<string, unknown>>;
  scopes?: string[];
  advances_key_results?: string[];
  knowledge_ids?: string[];
}

export interface IdeaUpdate {
  title?: string;
  description?: string;
  status?: IdeaStatus;
  category?: IdeaCategory;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  rejection_reason?: string;
  merged_into?: string;
  tags?: string[];
  related_ideas?: string[];
  guidelines?: string[];
  exploration_notes?: string;
  parent_id?: string;
  relations?: Array<Record<string, unknown>>;
  scopes?: string[];
  advances_key_results?: string[];
  knowledge_ids?: string[];
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

export interface ChangeRecord {
  id: string;
  task_id: string;
  file: string;
  action: ChangeAction;
  summary: string;
  reasoning_trace?: Array<{ step: string; detail: string }>;
  decision_ids?: string[];
  lines_added?: number;
  lines_removed?: number;
  group_id?: string;
  guidelines_checked?: string[];
  recorded_at: string;
}

export interface ChangeCreate {
  task_id: string;
  file: string;
  action: ChangeAction;
  summary: string;
  reasoning_trace?: Array<{ step: string; detail: string }>;
  decision_ids?: string[];
  lines_added?: number;
  lines_removed?: number;
  group_id?: string;
  guidelines_checked?: string[];
}

// ---------------------------------------------------------------------------
// Guidelines
// ---------------------------------------------------------------------------

export interface Guideline {
  id: string;
  title: string;
  scope: string;
  content: string;
  rationale?: string;
  examples: string[];
  weight: GuidelineWeight;
  status: GuidelineStatus;
  tags: string[];
  created_at: string;
}

export interface GuidelineCreate {
  title: string;
  scope: string;
  content: string;
  rationale?: string;
  examples?: string[];
  tags?: string[];
  weight?: GuidelineWeight;
}

export interface GuidelineUpdate {
  title?: string;
  content?: string;
  status?: GuidelineStatus;
  rationale?: string;
  scope?: string;
  examples?: string[];
  tags?: string[];
  weight?: GuidelineWeight;
  derived_from?: string;
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export interface Knowledge {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  status: KnowledgeStatus;
  scopes: string[];
  tags: string[];
  source?: Record<string, unknown> | null;
  linked_entities: Array<Record<string, unknown>>;
  dependencies: string[];
  review_interval_days: number;
  created_by: "user" | "ai";
  created_at: string;
  updated_at?: string;
}

export interface KnowledgeCreate {
  title: string;
  category: KnowledgeCategory;
  content: string;
  scopes?: string[];
  tags?: string[];
  source?: Record<string, unknown> | null;
  linked_entities?: Array<Record<string, unknown>>;
  dependencies?: string[];
  review_interval_days?: number;
  created_by?: "user" | "ai";
}

export interface KnowledgeUpdate {
  title?: string;
  content?: string;
  status?: KnowledgeStatus;
  category?: KnowledgeCategory;
  scopes?: string[];
  tags?: string[];
  source?: Record<string, unknown> | null;
  dependencies?: string[];
  review_interval_days?: number;
  change_reason?: string;
  changed_by?: "user" | "ai";
}

export interface KnowledgeLink {
  entity_type: KnowledgeLinkEntityType;
  entity_id: string;
  relation: KnowledgeLinkRelation;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export interface Lesson {
  id: string;
  category: LessonCategory;
  title: string;
  detail: string;
  task_id?: string;
  decision_ids?: string[];
  severity?: LessonSeverity;
  applies_to?: string;
  tags: string[];
  project?: string;
  created_at: string;
}

export interface LessonCreate {
  category: LessonCategory;
  title: string;
  detail: string;
  task_id?: string;
  decision_ids?: string[];
  severity?: LessonSeverity;
  applies_to?: string;
  tags?: string[];
}

export interface LessonPromote {
  target: "guideline" | "knowledge";
  scope?: string;
  weight?: GuidelineWeight;
  category?: string;
  scopes?: string[];
}

// ---------------------------------------------------------------------------
// AC Templates
// ---------------------------------------------------------------------------

export interface ACTemplate {
  id: string;
  title: string;
  template: string;
  category: ACTemplateCategory;
  description?: string;
  parameters?: Array<{ name: string; type: string; default?: unknown; description?: string }>;
  scopes: string[];
  tags: string[];
  verification_method?: string;
  usage_count?: number;
  status: "ACTIVE" | "DEPRECATED";
  created_at: string;
}

export interface ACTemplateCreate {
  title: string;
  template: string;
  category: ACTemplateCategory;
  description?: string;
  parameters?: Array<{ name: string; type: string; default?: unknown; description?: string }>;
  scopes?: string[];
  tags?: string[];
  verification_method?: string;
}

export interface ACTemplateUpdate {
  title?: string;
  template?: string;
  description?: string;
  category?: string;
  parameters?: Array<{ name: string; type: string; default?: unknown; description?: string }>;
  scopes?: string[];
  tags?: string[];
  verification_method?: string;
  status?: "ACTIVE" | "DEPRECATED";
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export interface Gate {
  name: string;
  command: string;
  required: boolean;
}

export interface GateCreate {
  name: string;
  command: string;
  required?: boolean;
}

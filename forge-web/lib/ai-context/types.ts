/**
 * AI Context Annotations — lightweight types for component self-description.
 *
 * Components call useAIElement() to describe themselves to AI.
 * No rendering — pure description layer that feeds into chat context.
 */

/** What a component tells AI about itself */
export interface AIElementDescriptor {
  /** Unique ID, stable across re-renders (e.g., "task-list", "status-filter") */
  id: string;

  /** Element category */
  type:
    | "button"
    | "card"
    | "form"
    | "filter"
    | "list"
    | "input"
    | "display"
    | "section"
    | "action"
    | "sidebar";

  /** Human-readable label (e.g., "Status Filter", "New Task") */
  label?: string;

  /** What this element shows or does, for AI understanding */
  description?: string;

  /** Current value (for inputs, filters, toggles) */
  value?: unknown;

  /** Available actions on this element */
  actions?: AIActionDescriptor[];

  /** Summary data (e.g., list count, status distribution) */
  data?: Record<string, unknown>;
}

/** An action available on an element */
export interface AIActionDescriptor {
  /** Action label (e.g., "Start", "Delete", "Submit") */
  label: string;

  /** What this action does */
  description?: string;

  /** LLM tool name (e.g., "createTask", "updateDecision") */
  toolName?: string;

  /** Key parameters the tool accepts (e.g., ["name*", "description", "type*"]) */
  toolParams?: string[];

  /** API endpoint — used for scope derivation (e.g., "/projects/{slug}/tasks/{id}") */
  endpoint?: string;

  /** HTTP method — used alongside endpoint for scope derivation */
  method?: string;

  /** Whether this action is currently available */
  available?: boolean;

  /** Human-readable condition for availability */
  availableWhen?: string;
}

/** Page-level metadata */
export interface AIPageConfig {
  /** Page identifier (e.g., "tasks", "ideas") */
  id: string;

  /** Human-readable page title */
  title: string;

  /** Brief description for AI */
  description?: string;

  /** URL route pattern */
  route?: string;
}

/** Snapshot of all collected annotations at a point in time */
export interface AIContextSnapshot {
  pageConfig: AIPageConfig | null;
  elements: Map<string, AIElementDescriptor>;
}

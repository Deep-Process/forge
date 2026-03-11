/**
 * Category color system for Skills.
 *
 * Maps each skill category to Tailwind utility classes
 * for badges and sidebar indicators.
 */

export interface CategoryColor {
  bg: string;
  text: string;
  border: string;
  dot: string;       // small color indicator
}

const COLORS: Record<string, CategoryColor> = {
  workflow:      { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  analysis:      { bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  dot: "bg-purple-500" },
  generation:    { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   dot: "bg-green-500" },
  validation:    { bg: "bg-yellow-100",  text: "text-yellow-700",  border: "border-yellow-200",  dot: "bg-yellow-500" },
  integration:   { bg: "bg-cyan-100",    text: "text-cyan-700",    border: "border-cyan-200",    dot: "bg-cyan-500" },
  refactoring:   { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500" },
  testing:       { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500" },
  deployment:    { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200",  dot: "bg-indigo-500" },
  documentation: { bg: "bg-gray-100",    text: "text-gray-700",    border: "border-gray-200",    dot: "bg-gray-500" },
  custom:        { bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-200",   dot: "bg-slate-500" },
};

const FALLBACK: CategoryColor = COLORS.custom;

/** Get Tailwind color classes for a skill category. */
export function getCategoryColor(category: string): CategoryColor {
  return COLORS[category] ?? FALLBACK;
}

/** Capitalize first letter of category key for display. */
export function categoryLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

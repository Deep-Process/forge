"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Maps URL segments to display labels. */
const SEGMENT_LABELS: Record<string, string> = {
  projects: "Projects",
  tasks: "Tasks",
  decisions: "Decisions",
  objectives: "Objectives",
  ideas: "Ideas",
  changes: "Changes",
  guidelines: "Guidelines",
  knowledge: "Knowledge",
  lessons: "Lessons",
  "ac-templates": "AC Templates",
  board: "Board",
  debug: "Debug",
  execution: "Execution",
  settings: "Settings",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items from segments
  const items: Array<{ label: string; href: string }> = [];
  let path = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += `/${seg}`;

    // Skip dynamic segments that come after known parents (e.g., [slug], [id])
    const label = SEGMENT_LABELS[seg] ?? seg;
    items.push({ label, href: path });
  }

  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1.5">
            {i > 0 && <span>/</span>}
            {isLast ? (
              <span className="text-gray-700 font-medium">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-gray-600">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

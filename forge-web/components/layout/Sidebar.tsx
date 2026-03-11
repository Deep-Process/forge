"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const globalNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "Projects", href: "/projects", icon: "folder" },
  { label: "Skills", href: "/skills", icon: "skills" },
];

const iconMap: Record<string, string> = {
  grid: "\u25A6",
  folder: "\u{1F4C1}",
  skills: "\u26A1",
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[var(--sidebar-width)] flex-shrink-0 border-r bg-white flex flex-col">
      <div className="p-4 border-b">
        <Link href="/" className="text-xl font-bold text-forge-700">
          Forge
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">v2.0</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {globalNav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                active
                  ? "bg-forge-50 text-forge-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{iconMap[item.icon] ?? ""}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t text-xs text-gray-400">
        Forge Platform v2.0
      </div>
    </aside>
  );
}

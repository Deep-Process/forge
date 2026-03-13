import Link from "next/link";
import type { Skill } from "@/lib/types";
import { Badge, statusVariant } from "@/components/shared/Badge";
import { getCategoryColor, categoryLabel } from "@/lib/utils/categoryColors";

/** Sync status relative to git repo */
export type SyncIndicator = "synced" | "modified" | "local-only" | "untracked" | "repo-only";

interface SkillRowProps {
  skill: Skill;
  selected?: boolean;
  onSelect?: (name: string, checked: boolean) => void;
  syncIndicator?: SyncIndicator;
  isRepoOnly?: boolean;
  onCheckout?: (name: string) => void;
  onDeleteRemote?: (name: string) => void;
  checkoutLoading?: boolean;
}

const SYNC_STYLES: Record<SyncIndicator, { color: string; title: string }> = {
  synced: { color: "bg-green-400", title: "Synced — up to date with repo" },
  modified: { color: "bg-amber-400", title: "Modified locally — differs from repo" },
  "local-only": { color: "bg-gray-300", title: "Local only — not synced to repo" },
  untracked: { color: "bg-blue-400", title: "New — not yet in repo" },
  "repo-only": { color: "bg-purple-400", title: "Repo only — not pulled locally" },
};

export function SkillRow({ skill: s, selected, onSelect, syncIndicator, isRepoOnly, onCheckout, onDeleteRemote, checkoutLoading }: SkillRowProps) {
  const cats = s.categories ?? [];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors group ${isRepoOnly ? "bg-gray-50 border-dashed border-gray-300" : "bg-white hover:border-forge-300"}`}>
      {/* Checkbox — not for repo-only skills */}
      {onSelect && !isRepoOnly && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => onSelect(s.name, e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-forge-600 focus:ring-forge-500 flex-shrink-0"
        />
      )}

      {/* Name — link for local, plain text for repo-only */}
      {isRepoOnly ? (
        <span className="font-semibold text-sm truncate min-w-0 text-gray-400 flex-shrink-0 max-w-[200px]">
          {s.display_name || s.name}
        </span>
      ) : (
        <Link
          href={`/skills/${s.name}`}
          className="font-semibold text-sm truncate min-w-0 hover:text-forge-600 flex-shrink-0 max-w-[200px]"
        >
          {s.display_name || s.name}
        </Link>
      )}

      {/* Category badges (max 2, +N) */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {cats.slice(0, 2).map((c) => {
          const cc = getCategoryColor(c);
          return (
            <span key={c} className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${cc.bg} ${cc.text}`}>
              {categoryLabel(c)}
            </span>
          );
        })}
        {cats.length > 2 && (
          <span className="text-[10px] text-gray-400">+{cats.length - 2}</span>
        )}
      </div>

      {/* Sync status dot */}
      {(() => {
        const indicator = syncIndicator ?? (isRepoOnly ? "repo-only" : s.sync ? "synced" : "local-only");
        const style = SYNC_STYLES[indicator];
        return (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${style.color}`}
            title={style.title}
          />
        );
      })()}

      {/* Description */}
      <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
        {s.description}
      </span>

      {/* Repo-only action buttons */}
      {isRepoOnly && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onCheckout && (
            <button
              onClick={(e) => { e.preventDefault(); onCheckout(s.name); }}
              disabled={checkoutLoading}
              className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
              title="Pull this skill from the repository"
            >
              {checkoutLoading ? "Pulling..." : "Pull"}
            </button>
          )}
          {onDeleteRemote && (
            <button
              onClick={(e) => { e.preventDefault(); onDeleteRemote(s.name); }}
              className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
              title="Delete this skill from the repository"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Stats (subtle) — only for local skills */}
      {!isRepoOnly && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-shrink-0">
          {(s.usage_count ?? 0) > 0 && (
            <span>used {s.usage_count}x</span>
          )}
          {s.promoted_with_warnings && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Promoted with warnings" />
          )}
        </div>
      )}

      {/* Status badge — right-aligned, fixed width */}
      <Badge
        variant={isRepoOnly ? "default" : statusVariant(s.status)}
        className="text-[10px] px-1.5 py-0 w-20 text-center justify-center flex-shrink-0"
      >
        {isRepoOnly ? "REPO" : s.status}
      </Badge>
    </div>
  );
}

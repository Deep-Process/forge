"use client";

import { useChatStore } from "@/stores/chatStore";

function budgetColor(pct: number): string {
  if (pct >= 80) return "text-red-600";
  if (pct >= 60) return "text-amber-600";
  return "text-gray-500";
}

function budgetBg(pct: number): string {
  if (pct >= 80) return "bg-red-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-forge-500";
}

export default function TokenCounter() {
  const { activeSessionId, conversations, sendMessage } = useChatStore();
  const conv = activeSessionId ? conversations[activeSessionId] : null;

  if (!conv || (conv.totalTokensIn === 0 && conv.totalTokensOut === 0)) {
    return null;
  }

  const totalTokens = conv.totalTokensIn + conv.totalTokensOut;
  const pct = conv.contextBudgetPct;
  const showWarning = pct >= 80;

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="border-t bg-gray-50 px-3 py-1.5">
      <div className="flex items-center gap-2">
        {/* Budget bar */}
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetBg(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        {/* Token count */}
        <span className={`text-[10px] font-medium whitespace-nowrap ${budgetColor(pct)}`}>
          {formatTokens(totalTokens)} tokens ({Math.round(pct)}%)
        </span>
      </div>
      {/* Warning banner */}
      {showWarning && (
        <div className="mt-1.5 flex items-center justify-between rounded bg-red-50 px-2 py-1 border border-red-200">
          <span className="text-[10px] text-red-700">
            Context window {Math.round(pct)}% full. Start a new session to avoid truncation.
          </span>
          <button
            onClick={() => {
              useChatStore.setState({ activeSessionId: null });
            }}
            className="text-[10px] font-medium text-red-700 hover:text-red-900 underline ml-2 whitespace-nowrap"
          >
            New session
          </button>
        </div>
      )}
    </div>
  );
}

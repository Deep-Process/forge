"use client";

import { useRef, useState, useCallback, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled = false, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Type a message..."}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm
          focus:border-forge-500 focus:outline-none focus:ring-1 focus:ring-forge-500
          disabled:bg-gray-50 disabled:text-gray-400"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-forge-600 px-3 py-2 text-sm font-medium text-white
          hover:bg-forge-700 disabled:bg-gray-300 disabled:cursor-not-allowed
          transition-colors"
      >
        Send
      </button>
    </div>
  );
}

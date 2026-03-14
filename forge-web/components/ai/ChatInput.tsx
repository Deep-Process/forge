"use client";

import { useRef, useState, useCallback, useMemo, useEffect, type KeyboardEvent, type DragEvent } from "react";
import type { ChatFileAttachment } from "@/lib/types";
import { llm } from "@/lib/api";
import { useAIElement } from "@/lib/ai-context";
import { useSkillStore, fetchSkills } from "@/stores/skillStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { extractMentionAtCursor, getCaretCoordinates } from "@/lib/utils/mentionUtils";
import SlashCommandDropdown, {
  getFilteredCommands,
  type SlashCommand,
} from "./SlashCommandDropdown";
import { MentionDropdown, type SkillMentionItem } from "./MentionDropdown";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_FILES_PER_SESSION = 10;
const ALLOWED_EXTENSIONS = new Set([
  ".md", ".txt", ".py", ".js", ".ts", ".json", ".yaml", ".yml",
  ".sh", ".css", ".html", ".pdf",
]);

type AutocompleteMode = "none" | "slash" | "mention";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

interface ChatInputProps {
  onSend: (message: string, fileIds?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  sessionId?: string | null;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  sessionId,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [attachments, setAttachments] = useState<ChatFileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Unified autocomplete controller (D-092 mitigation)
  const [autocompleteMode, setAutocompleteMode] = useState<AutocompleteMode>("none");
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionStartIdx, setMentionStartIdx] = useState(0);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const preSessionId = useRef(`pre-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // --- Skill stores ---
  const { items: skills } = useSkillStore();
  const attachedSkills = useSidebarStore((s) => s.attachedSkills);
  const clearSkills = useSidebarStore((s) => s.clearSkills);

  useEffect(() => {
    if (skills.length === 0) fetchSkills();
  }, [skills.length]);

  // ToolsTab integration: when skills are attached via ToolsTab, insert @mention into textarea
  useEffect(() => {
    if (attachedSkills.length === 0) return;
    const mentions = attachedSkills.map((s) => `@${s.name}`).join(" ");
    setValue((prev) => {
      const needsSpace = prev.length > 0 && !prev.endsWith(" ") && !prev.endsWith("\n");
      return prev + (needsSpace ? " " : "") + mentions + " ";
    });
    clearSkills();
    textareaRef.current?.focus();
  }, [attachedSkills, clearSkills]);

  const skillCommands = useMemo<SlashCommand[]>(
    () =>
      skills.map((s) => ({
        name: s.name,
        label: s.display_name || s.name,
        description: s.description,
        source: "skill" as const,
      })),
    [skills],
  );

  const mentionSkills = useMemo<SkillMentionItem[]>(
    () =>
      skills.map((s) => ({
        name: s.name,
        display_name: s.display_name || s.name,
        description: s.description,
      })),
    [skills],
  );

  // Highlight @mentions in overlay
  const highlightedText = useMemo(() => {
    if (!value) return null;
    const regex = /@([a-z0-9][a-z0-9-]*)/g;
    const result: (string | JSX.Element)[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIdx) result.push(value.slice(lastIdx, match.index));
      result.push(
        <span key={match.index} className="text-blue-600 font-semibold">{match[0]}</span>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < value.length) result.push(value.slice(lastIdx));
    result.push("\n");
    return result;
  }, [value]);

  const syncScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Determine slash filter
  const slashFilter = autocompleteMode === "slash" && value.startsWith("/") ? value.slice(1) : "";

  // AI annotation for mention dropdown
  useAIElement({
    id: "mention-dropdown",
    type: "input",
    label: "Skill @-mention",
    value: autocompleteMode === "mention" ? `@${mentionFilter}` : "",
  });

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setValue(`/${cmd.name} `);
    setAutocompleteMode("none");
    setSlashIndex(0);
    textareaRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback(
    (skill: SkillMentionItem) => {
      // Complete @mention inline — keep as text in textarea
      const before = value.slice(0, mentionStartIdx);
      const after = value.slice(mentionStartIdx + 1 + mentionFilter.length);
      setValue(before + "@" + skill.name + " " + after);
      setAutocompleteMode("none");
      setMentionIndex(0);
      setMentionFilter("");
      textareaRef.current?.focus();
    },
    [value, mentionStartIdx, mentionFilter],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    const fileIds = attachments.length > 0
      ? attachments.map((a) => a.file_id)
      : undefined;
    onSend(trimmed || "(files attached)", fileIds);
    setValue("");
    setAttachments([]);
    setUploadError(null);
  }, [value, disabled, onSend, attachments]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash-command navigation
      if (autocompleteMode === "slash") {
        const filtered = getFilteredCommands(slashFilter, skillCommands);
        const count = filtered.length;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((prev) => (prev + 1) % Math.max(count, 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((prev) => (prev - 1 + Math.max(count, 1)) % Math.max(count, 1));
          return;
        }
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          const cmd = filtered[slashIndex];
          if (cmd) {
            e.preventDefault();
            handleSlashSelect(cmd);
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAutocompleteMode("none");
          setSlashIndex(0);
          return;
        }
      }

      // Mention navigation
      if (autocompleteMode === "mention") {
        const filtered = mentionSkills.filter(
          (s) =>
            s.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
            s.display_name.toLowerCase().includes(mentionFilter.toLowerCase()),
        );
        const count = filtered.length;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % Math.max(count, 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) => (prev - 1 + Math.max(count, 1)) % Math.max(count, 1));
          return;
        }
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          const skill = filtered[mentionIndex];
          if (skill) {
            e.preventDefault();
            handleMentionSelect(skill);
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAutocompleteMode("none");
          setMentionIndex(0);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, autocompleteMode, slashFilter, slashIndex, skillCommands, handleSlashSelect,
     mentionFilter, mentionIndex, mentionSkills, handleMentionSelect, value],
  );

  const handleChange = useCallback(
    (newVal: string) => {
      setValue(newVal);

      const el = textareaRef.current;

      // Slash detection: '/' at position 0, no space yet
      if (newVal.startsWith("/") && !newVal.includes(" ")) {
        setAutocompleteMode("slash");
        setSlashIndex(0);
        return;
      }

      // Mention detection (only if not in slash mode)
      if (el) {
        const cursorPos = el.selectionStart ?? newVal.length;
        const mention = extractMentionAtCursor(newVal, cursorPos);
        if (mention) {
          const coords = getCaretCoordinates(el, mention.startIndex);
          setMentionFilter(mention.filter);
          setMentionStartIdx(mention.startIndex);
          setMentionPos(coords);
          setAutocompleteMode("mention");
          setMentionIndex(0);
          return;
        }
      }

      setAutocompleteMode("none");
    },
    [],
  );

  // --- Drag & Drop ---
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragging(false);
      setUploadError(null);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      if (uploading) return;

      const sid = sessionId ?? preSessionId.current;

      const remaining = MAX_FILES_PER_SESSION - attachments.length;
      if (remaining <= 0) {
        setUploadError(`Session limit reached (max ${MAX_FILES_PER_SESSION} files).`);
        return;
      }

      const toUpload = files.slice(0, remaining);
      const rejected: string[] = [];

      const valid: File[] = [];
      for (const file of toUpload) {
        const ext = getExtension(file.name);
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          rejected.push(`${file.name}: unsupported type (${ext || "no extension"})`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name}: too large (${formatFileSize(file.size)}, max 1 MB)`);
          continue;
        }
        valid.push(file);
      }

      if (files.length > toUpload.length) {
        rejected.push(`${files.length - toUpload.length} file(s) skipped — session limit.`);
      }

      if (valid.length === 0) {
        setUploadError(rejected.join("; "));
        return;
      }

      setUploading(true);
      const newAttachments: ChatFileAttachment[] = [];
      const errors: string[] = [...rejected];

      for (const file of valid) {
        try {
          const result = await llm.uploadFile(file, sid);
          newAttachments.push(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          errors.push(`${file.name}: ${msg}`);
        }
      }

      setUploading(false);

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
      if (errors.length > 0) {
        setUploadError(errors.join("; "));
      }
    },
    [sessionId, attachments.length],
  );

  const removeAttachment = useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.file_id !== fileId));
  }, []);

  return (
    <div
      className="relative border-t border-gray-200 bg-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-lg border-2 border-dashed border-forge-400 bg-forge-50/90">
          <div className="text-center">
            <svg className="mx-auto h-8 w-8 text-forge-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-1 text-sm font-medium text-forge-700">Drop files to attach</p>
            <p className="text-xs text-forge-500">Max 1 MB per file</p>
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-2 underline hover:no-underline">
            dismiss
          </button>
        </div>
      )}

      {/* File attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {attachments.map((att) => (
            <span
              key={att.file_id}
              className="inline-flex items-center gap-1 rounded-full bg-forge-100 px-2.5 py-1 text-xs text-forge-700"
            >
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[120px] truncate" title={att.filename}>{att.filename}</span>
              <span className="text-forge-400">({formatFileSize(att.size)})</span>
              <button
                onClick={() => removeAttachment(att.file_id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-forge-200 transition-colors"
                title="Remove"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="px-3 pt-1 text-xs text-forge-500 animate-pulse">
          Uploading files...
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2 p-3">
        {/* Slash-command dropdown */}
        {autocompleteMode === "slash" && (
          <SlashCommandDropdown
            filter={slashFilter}
            skillCommands={skillCommands}
            selectedIndex={slashIndex}
            onSelect={handleSlashSelect}
          />
        )}
        {/* Mention dropdown */}
        {autocompleteMode === "mention" && (
          <MentionDropdown
            filter={mentionFilter}
            skills={mentionSkills}
            selectedIndex={mentionIndex}
            onSelect={handleMentionSelect}
            position={mentionPos}
          />
        )}
        <div className="relative flex-1">
          {/* Highlight overlay for @mentions */}
          <div
            ref={highlightRef}
            className="absolute inset-0 px-3 py-2 text-sm pointer-events-none
              overflow-hidden whitespace-pre-wrap break-words text-gray-900
              border border-transparent rounded-lg"
            aria-hidden="true"
          >
            {highlightedText}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            placeholder={placeholder ?? "Type a message, use / for commands, @ for skills..."}
            disabled={disabled}
            rows={3}
            className="relative w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm
              min-h-[72px] max-h-[50vh] overflow-y-auto bg-transparent
              text-transparent caret-gray-900 selection:bg-blue-200/50
              placeholder:text-gray-400
              focus:border-forge-500 focus:outline-none focus:ring-1 focus:ring-forge-500
              disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          className="rounded-lg bg-forge-600 px-3 py-2 text-sm font-medium text-white
            hover:bg-forge-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

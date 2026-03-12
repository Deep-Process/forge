"use client";

import { useState, useCallback } from "react";
import type { SkillFile, SkillFileType } from "@/lib/types";

const FOLDERS = [
  { prefix: "scripts/", label: "scripts", icon: "S" },
  { prefix: "references/", label: "references", icon: "R" },
  { prefix: "assets/", label: "assets", icon: "A" },
] as const;

const ALLOWED_EXTENSIONS = new Set([
  ".md", ".txt", ".py", ".js", ".ts", ".json", ".yaml", ".yml", ".sh", ".css", ".html",
]);
const MAX_DROP_FILES = 10;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/** Map file extension to target directory and file_type. */
function classifyFile(name: string): { folder: string; file_type: SkillFileType } {
  const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  if ([".py", ".sh", ".js", ".ts"].includes(ext)) return { folder: "scripts/", file_type: "script" };
  if ([".md", ".txt"].includes(ext)) return { folder: "references/", file_type: "reference" };
  return { folder: "assets/", file_type: "asset" };
}

interface SkillFileTreeProps {
  files: SkillFile[];
  activeFile: string;
  onSelect: (path: string) => void;
  onAdd: (folder: string, name: string) => void;
  onDelete: (path: string) => void;
  onDropFiles?: (newFiles: SkillFile[]) => void;
  readOnly?: boolean;
}

export function SkillFileTree({
  files,
  activeFile,
  onSelect,
  onAdd,
  onDelete,
  onDropFiles,
  readOnly,
}: SkillFileTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const toggleFolder = (prefix: string) => {
    setCollapsed((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  const filesInFolder = (prefix: string) =>
    files.filter((f) => f.path.startsWith(prefix));

  const rootFiles = files.filter(
    (f) => !FOLDERS.some((folder) => f.path.startsWith(folder.prefix)),
  );

  const handleAdd = (folder: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(folder, trimmed);
    setNewName("");
    setAdding(null);
  };

  const cancelAdd = () => {
    setNewName("");
    setAdding(null);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly || !onDropFiles) return;
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, [readOnly, onDropFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setDropError(null);

    if (readOnly || !onDropFiles) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (droppedFiles.length > MAX_DROP_FILES) {
      setDropError(`Max ${MAX_DROP_FILES} files per drop`);
      return;
    }

    const errors: string[] = [];
    const newFiles: SkillFile[] = [];
    const existingPaths = new Set(files.map((f) => f.path));

    for (const file of droppedFiles) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        errors.push(`${file.name}: unsupported extension`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: too large (max 1MB)`);
        continue;
      }

      const { folder, file_type } = classifyFile(file.name);
      const path = `${folder}${file.name}`;

      if (existingPaths.has(path)) {
        errors.push(`${path}: already exists`);
        continue;
      }

      try {
        const content = await file.text();
        newFiles.push({ path, content, file_type });
        existingPaths.add(path);
      } catch {
        errors.push(`${file.name}: read error`);
      }
    }

    if (errors.length > 0) {
      setDropError(errors.join("; "));
    }
    if (newFiles.length > 0) {
      onDropFiles(newFiles);
    }
  }, [readOnly, onDropFiles, files]);

  return (
    <div
      className={`flex flex-col h-full text-xs select-none relative ${
        dragOver ? "ring-2 ring-inset ring-forge-400 bg-forge-50/50" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-forge-50/80 z-10 pointer-events-none">
          <div className="text-center">
            <div className="text-forge-600 font-medium text-sm">Drop files here</div>
            <div className="text-[10px] text-forge-400 mt-0.5">.md .txt .py .js .ts .json .yaml .sh</div>
          </div>
        </div>
      )}

      {/* Drop error */}
      {dropError && (
        <div className="px-2 py-1 bg-red-50 text-red-600 text-[10px] border-b border-red-200">
          {dropError}
          <button onClick={() => setDropError(null)} className="ml-1 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* SKILL.md — always first, not deletable */}
      <button
        onClick={() => onSelect("SKILL.md")}
        className={`flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-gray-100 transition-colors ${
          activeFile === "SKILL.md" ? "bg-forge-50 text-forge-700 font-medium" : "text-gray-700"
        }`}
      >
        <span className="text-[10px] text-forge-500">MD</span>
        <span className="truncate">SKILL.md</span>
      </button>

      {/* Root-level files */}
      {rootFiles.map((f) => (
        <div key={f.path} className="group flex items-center">
          <button
            onClick={() => onSelect(f.path)}
            className={`flex-1 flex items-center gap-1.5 px-2 py-1 text-left hover:bg-gray-100 truncate ${
              activeFile === f.path ? "bg-forge-50 text-forge-700 font-medium" : "text-gray-600"
            }`}
          >
            <span className="text-[10px] text-gray-400">F</span>
            <span className="truncate">{f.path}</span>
          </button>
          {!readOnly && (
            <button
              onClick={() => onDelete(f.path)}
              className="hidden group-hover:block px-1.5 text-red-400 hover:text-red-600"
              title="Delete file"
            >
              &times;
            </button>
          )}
        </div>
      ))}

      {/* Folders */}
      {FOLDERS.map(({ prefix, label, icon }) => {
        const folderFiles = filesInFolder(prefix);
        const isCollapsed = collapsed[prefix];

        return (
          <div key={prefix}>
            {/* Folder header */}
            <div className="group flex items-center">
              <button
                onClick={() => toggleFolder(prefix)}
                className="flex-1 flex items-center gap-1 px-2 py-1 text-left hover:bg-gray-100 text-gray-500 font-medium"
              >
                <span className="text-[10px]">{isCollapsed ? "\u25B6" : "\u25BC"}</span>
                <span>{label}/</span>
                <span className="text-[10px] text-gray-400 ml-auto">{folderFiles.length}</span>
              </button>
              {!readOnly && (
                <button
                  onClick={() => { setAdding(prefix); setNewName(""); }}
                  className="hidden group-hover:block px-1.5 text-green-500 hover:text-green-700"
                  title={`Add file to ${label}/`}
                >
                  +
                </button>
              )}
            </div>

            {/* Inline add input */}
            {adding === prefix && (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-50">
                <span className="text-[10px] text-gray-400">{prefix}</span>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd(prefix);
                    if (e.key === "Escape") cancelAdd();
                  }}
                  className="flex-1 min-w-0 border rounded px-1 py-0.5 text-xs focus:border-forge-500 focus:outline-none"
                  placeholder="filename"
                />
                <button onClick={() => handleAdd(prefix)} className="text-green-600 hover:text-green-800">
                  &#10003;
                </button>
                <button onClick={cancelAdd} className="text-gray-400 hover:text-gray-600">
                  &times;
                </button>
              </div>
            )}

            {/* Files in folder */}
            {!isCollapsed &&
              folderFiles.map((f) => {
                const fileName = f.path.slice(prefix.length);
                return (
                  <div key={f.path} className="group flex items-center">
                    <button
                      onClick={() => onSelect(f.path)}
                      className={`flex-1 flex items-center gap-1.5 pl-5 pr-2 py-1 text-left hover:bg-gray-100 truncate ${
                        activeFile === f.path ? "bg-forge-50 text-forge-700 font-medium" : "text-gray-600"
                      }`}
                    >
                      <span className="text-[10px] text-gray-400">{icon}</span>
                      <span className="truncate">{fileName}</span>
                    </button>
                    {!readOnly && (
                      <button
                        onClick={() => onDelete(f.path)}
                        className="hidden group-hover:block px-1.5 text-red-400 hover:text-red-600"
                        title="Delete file"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/types";

const FOLDERS = [
  { prefix: "scripts/", label: "scripts", icon: "S" },
  { prefix: "references/", label: "references", icon: "R" },
  { prefix: "assets/", label: "assets", icon: "A" },
] as const;

interface SkillFileTreeProps {
  files: SkillFile[];
  activeFile: string; // "SKILL.md" or file path
  onSelect: (path: string) => void;
  onAdd: (folder: string, name: string) => void;
  onDelete: (path: string) => void;
  readOnly?: boolean;
}

export function SkillFileTree({
  files,
  activeFile,
  onSelect,
  onAdd,
  onDelete,
  readOnly,
}: SkillFileTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null); // folder prefix being added to
  const [newName, setNewName] = useState("");

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

  return (
    <div className="flex flex-col h-full text-xs select-none">
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

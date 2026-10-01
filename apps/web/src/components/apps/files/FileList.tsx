"use client";

import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
} from "lucide-react";
import { useState } from "react";
import type { DragEvent as ReactDragEvent, MouseEvent } from "react";
import { getFileType } from "@/src/lib/files/file-type";
import { formatModified, formatSize } from "@/src/lib/files/format";
import { parentPath, type FileEntry } from "@/src/lib/api/files";

const DRAG_MIME = "application/x-serverui-file";

function readDragPath(event: ReactDragEvent): string | null {
  const direct = event.dataTransfer.getData(DRAG_MIME);
  if (direct) return direct;
  const plain = event.dataTransfer.getData("text/plain");
  return plain || null;
}

export function FileList({
  path,
  entries,
  selected,
  onSelect,
  onOpen,
  onParent,
  onContextMenu,
  onMove,
}: {
  path: string;
  entries: FileEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (entry: FileEntry) => void;
  onParent: () => void;
  onContextMenu: (event: MouseEvent, entry: FileEntry | null) => void;
  onMove: (sourcePath: string, destDir: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const parentDest = parentPath(path);

  function overDest(event: ReactDragEvent, dest: string) {
    if (event.dataTransfer.types.length === 0) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTarget !== dest) setDropTarget(dest);
  }

  function dropOnto(event: ReactDragEvent, dest: string) {
    event.preventDefault();
    setDropTarget(null);
    const source = readDragPath(event);
    if (source) onMove(source, dest);
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          onContextMenu(event, null);
        }
      }}
    >
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 z-10 sui-app text-[11px] sui-muted">
          <tr className="border-b sui-hairline">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Modified</th>
          </tr>
        </thead>
        <tbody>
          {path !== "/" ? (
            <tr
              className={`cursor-default border-b sui-hairline sui-hover ${dropTarget === parentDest ? "bg-sky-100 outline outline-2 outline-sky-400" : ""}`}
              onDoubleClick={onParent}
              onDragOver={(event) => overDest(event, parentDest)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => dropOnto(event, parentDest)}
            >
              <td className="px-4 py-1.5" colSpan={3}>
                <button
                  type="button"
                  className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  onClick={onParent}
                >
                  <Folder aria-hidden className="size-4 fill-sky-400 text-sky-500" />
                  ..
                </button>
              </td>
            </tr>
          ) : null}
          {entries.map((entry) => (
            <FileItem
              key={entry.path}
              entry={entry}
              selected={selected === entry.path}
              dropActive={dropTarget === entry.path}
              onSelect={() => onSelect(entry.path)}
              onOpen={() => onOpen(entry)}
              onContextMenu={(event) => onContextMenu(event, entry)}
              onDragStart={(event) => {
                onSelect(entry.path);
                event.dataTransfer.setData(DRAG_MIME, entry.path);
                event.dataTransfer.setData("text/plain", entry.path);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={entry.type === "dir" ? (event) => overDest(event, entry.path) : undefined}
              onDragLeave={entry.type === "dir" ? () => setDropTarget(null) : undefined}
              onDrop={entry.type === "dir" ? (event) => dropOnto(event, entry.path) : undefined}
              onDragEnd={() => setDropTarget(null)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileItem({
  entry,
  selected,
  dropActive,
  onSelect,
  onOpen,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  entry: FileEntry;
  selected: boolean;
  dropActive: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onDragStart: (event: ReactDragEvent) => void;
  onDragOver?: (event: ReactDragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: ReactDragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <tr
      draggable
      className={`cursor-default border-b sui-hairline sui-hover ${selected ? "sui-selected" : ""} ${dropActive ? "bg-sky-100 outline outline-2 outline-sky-400" : ""}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <td className="px-4 py-1.5">
        <button
          type="button"
          className="flex max-w-full items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          onClick={onSelect}
          onDoubleClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
        >
          <EntryIcon entry={entry} />
          <span className="truncate">{entry.name}</span>
        </button>
      </td>
      <td className="px-4 py-1.5 whitespace-nowrap sui-muted">
        {entry.type === "dir" ? "—" : formatSize(entry.size)}
      </td>
      <td className="px-4 py-1.5 whitespace-nowrap sui-muted">{formatModified(entry.modified)}</td>
    </tr>
  );
}

function EntryIcon({ entry }: { entry: FileEntry }) {
  if (entry.type === "dir") {
    return <Folder aria-hidden className="size-4 shrink-0 fill-sky-400 text-sky-500" />;
  }
  const kind = getFileType({ name: entry.name, mime: entry.mime });
  const className = "size-4 shrink-0 text-neutral-400";
  switch (kind) {
    case "image":
      return <FileImage aria-hidden className={className} />;
    case "video":
      return <FileVideo aria-hidden className={className} />;
    case "audio":
      return <FileAudio aria-hidden className={className} />;
    case "pdf":
    case "text":
      return <FileText aria-hidden className={className} />;
    case "code":
      return <FileCode aria-hidden className={className} />;
    case "archive":
      return <FileArchive aria-hidden className={className} />;
    default:
      return <FileIcon aria-hidden className={className} />;
  }
}

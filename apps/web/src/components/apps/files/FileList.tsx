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
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { getFileType } from "@/src/lib/files/file-type";
import { formatModified, formatSize } from "@/src/lib/files/format";
import { parentPath, type FileEntry } from "@/src/lib/api/files";
import { FILE_DROP_ATTR, useFileMoveDrag } from "@/src/components/apps/files/use-file-move-drag";

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
  onMove: (sourcePath: string, destDir: string, sourceType: "file" | "dir") => void;
}) {
  const parentDest = parentPath(path);
  const { ghost, startPress, consumeClick } = useFileMoveDrag(onMove, path);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          onContextMenu(event, null);
        }
      }}
    >
      <table className="w-full table-fixed text-left text-[13px]">
        <thead className="sui-toolbar sticky top-0 z-10 text-[11px] sui-muted">
          <tr className="border-b sui-hairline">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="w-[22%] px-4 py-2 font-medium">Size</th>
            <th className="w-[28%] px-4 py-2 font-medium">Modified</th>
          </tr>
        </thead>
        <tbody>
          {path !== "/" ? (
            <tr
              {...{ [FILE_DROP_ATTR]: parentDest }}
              className={`cursor-default select-none border-b sui-hairline sui-hover ${ghost?.dest === parentDest ? "bg-sky-500/20 outline-2 outline-sky-400" : ""}`}
              onDoubleClick={onParent}
            >
              <td className="px-4 py-1.5" colSpan={3}>
                <span className="flex items-center gap-2">
                  <Folder aria-hidden className="size-4 fill-sky-400 text-sky-500" />
                  ..
                </span>
              </td>
            </tr>
          ) : null}
          {entries.map((entry) => (
            <FileItem
              key={entry.path}
              entry={entry}
              selected={selected === entry.path}
              dropActive={ghost?.dest === entry.path}
              onSelect={() => onSelect(entry.path)}
              onOpen={() => onOpen(entry)}
              onContextMenu={(event) => onContextMenu(event, entry)}
              onPointerDown={(event) => startPress(event, entry.path, entry.name, entry.type)}
              consumeClick={consumeClick}
            />
          ))}
        </tbody>
      </table>
      {ghost ? (
        <div
          className="pointer-events-none fixed z-[90] max-w-[220px] truncate rounded-md bg-black/80 px-2 py-1 text-[12px] text-white shadow-lg"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          {ghost.name}
        </div>
      ) : null}
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
  onPointerDown,
  consumeClick,
}: {
  entry: FileEntry;
  selected: boolean;
  dropActive: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  consumeClick: () => boolean;
}) {
  return (
    <tr
      {...(entry.type === "dir" ? { [FILE_DROP_ATTR]: entry.path } : {})}
      className={`cursor-default select-none border-b sui-hairline sui-hover ${selected ? "sui-selected" : ""} ${dropActive ? "bg-sky-500/20 outline-2 outline-sky-400" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
      onClick={() => {
        if (consumeClick()) return;
        onSelect();
      }}
      onDoubleClick={() => {
        if (consumeClick()) return;
        onOpen();
      }}
      onContextMenu={onContextMenu}
    >
      <td className="px-4 py-1.5">
        <span className="flex max-w-full items-center gap-2">
          <EntryIcon entry={entry} />
          <span className="truncate">{entry.name}</span>
        </span>
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

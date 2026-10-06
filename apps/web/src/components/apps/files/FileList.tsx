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
import { useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent } from "react";
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

type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function FileList({
  path,
  entries,
  selected,
  selectedPaths,
  onSelect,
  onToggleSelect,
  onSelectRange,
  onSelectionChange,
  onClearSelection,
  onOpen,
  onParent,
  onContextMenu,
  onMove,
}: {
  path: string;
  entries: FileEntry[];
  selected?: string | null;
  selectedPaths?: Set<string>;
  onSelect: (path: string, event?: MouseEvent) => void;
  onToggleSelect?: (path: string) => void;
  onSelectRange?: (path: string) => void;
  onSelectionChange?: (paths: Set<string>) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onOpen: (entry: FileEntry) => void;
  onParent: () => void;
  onContextMenu: (event: MouseEvent, entry: FileEntry | null) => void;
  onMove?: (sourcePath: string, destDir: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const parentDest = parentPath(path);

  const activeSelected = selectedPaths ?? (selected ? new Set([selected]) : new Set<string>());

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
    if (source && onMove) onMove(source, dest);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    const isHeader = Boolean(target.closest("thead"));
    const isParentRow = Boolean(target.closest("tr[data-parent]"));
    if (isHeader || isParentRow) return;

    const tr = target.closest("tr[data-path]") as HTMLTableRowElement | null;
    const clickedPath = tr?.getAttribute("data-path") ?? null;

    const initialClientX = e.clientX;
    const initialClientY = e.clientY;

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    let dragStarted = false;
    const baseSelection = new Set(activeSelected);

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const dist = Math.hypot(
        moveEvent.clientX - initialClientX,
        moveEvent.clientY - initialClientY,
      );

      if (!dragStarted && dist > 4) {
        dragStarted = true;
        document.body.style.userSelect = "none";
      }

      if (dragStarted && container) {
        const containerRect = container.getBoundingClientRect();

        const boxViewportLeft = Math.min(initialClientX, moveEvent.clientX);
        const boxViewportRight = Math.max(initialClientX, moveEvent.clientX);
        const boxViewportTop = Math.min(initialClientY, moveEvent.clientY);
        const boxViewportBottom = Math.max(initialClientY, moveEvent.clientY);

        setMarquee({
          left: boxViewportLeft - containerRect.left + container.scrollLeft,
          top: boxViewportTop - containerRect.top + container.scrollTop,
          width: boxViewportRight - boxViewportLeft,
          height: boxViewportBottom - boxViewportTop,
        });

        const rows = container.querySelectorAll<HTMLTableRowElement>("tr[data-path]");
        const intersectingPaths = new Set<string>();

        rows.forEach((row) => {
          const rowPath = row.getAttribute("data-path");
          if (!rowPath) return;

          const rowRect = row.getBoundingClientRect();
          const intersects =
            boxViewportLeft < rowRect.right &&
            boxViewportRight > rowRect.left &&
            boxViewportTop < rowRect.bottom &&
            boxViewportBottom > rowRect.top;

          if (intersects) {
            intersectingPaths.add(rowPath);
          }
        });

        if (isCtrlOrMeta) {
          const next = new Set(baseSelection);
          intersectingPaths.forEach((p) => {
            if (baseSelection.has(p)) {
              next.delete(p);
            } else {
              next.add(p);
            }
          });
          onSelectionChange?.(next);
        } else {
          onSelectionChange?.(intersectingPaths);
        }
      }
    }

    function handleMouseUp(upEvent: globalThis.MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";

      if (dragStarted) {
        setMarquee(null);
      } else {
        if (clickedPath) {
          if (isShift) {
            onSelectRange?.(clickedPath);
          } else if (isCtrlOrMeta) {
            onToggleSelect?.(clickedPath);
          } else {
            onSelect(clickedPath, upEvent as unknown as MouseEvent);
          }
        } else {
          onClearSelection?.();
        }
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-y-auto select-none"
      onMouseDown={handleMouseDown}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          onContextMenu(event, null);
        }
      }}
    >
      {marquee ? (
        <div
          data-testid="selection-marquee"
          className="pointer-events-none absolute z-20 rounded-[2px] border border-sky-500 bg-sky-500/20 dark:border-sky-400 dark:bg-sky-400/25"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      ) : null}
      <table className="w-full text-left text-[13px]">
        <thead className="sui-toolbar sticky top-0 z-10 text-[11px] sui-muted">
          <tr className="border-b sui-hairline">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Modified</th>
          </tr>
        </thead>
        <tbody>
          {path !== "/" ? (
            <tr
              data-parent="true"
              className={`cursor-default border-b sui-hairline sui-hover ${dropTarget === parentDest ? "bg-sky-100 outline outline-2 outline-sky-400" : ""}`}
              onClick={onParent}
              onDoubleClick={onParent}
              onDragOver={(event) => overDest(event, parentDest)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => dropOnto(event, parentDest)}
            >
              <td className="px-4 py-1.5" colSpan={3}>
                <div className="flex items-center gap-2">
                  <Folder aria-hidden className="size-4 fill-sky-400 text-sky-500" />
                  <span>..</span>
                </div>
              </td>
            </tr>
          ) : null}
          {entries.map((entry) => (
            <FileItem
              key={entry.path}
              entry={entry}
              selected={activeSelected.has(entry.path)}
              dropActive={dropTarget === entry.path}
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
      data-path={entry.path}
      draggable
      className={`cursor-default border-b sui-hairline sui-hover ${selected ? "sui-selected" : ""} ${dropActive ? "bg-sky-100 outline outline-2 outline-sky-400" : ""}`}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <td className="px-4 py-1.5">
        <div className="flex max-w-full items-center gap-2">
          <EntryIcon entry={entry} />
          <span className="truncate">{entry.name}</span>
        </div>
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

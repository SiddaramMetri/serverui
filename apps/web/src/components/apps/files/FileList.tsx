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
import { useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { getFileType } from "@/src/lib/files/file-type";
import { formatModified, formatSize } from "@/src/lib/files/format";
import { parentPath, type FileEntry } from "@/src/lib/api/files";
import { FILE_DROP_ATTR, useFileMoveDrag } from "@/src/components/apps/files/use-file-move-drag";

type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const DRAG_THRESHOLD = 5;

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
  onMove?: (sourcePath: string, destDir: string, sourceType: "file" | "dir") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const parentDest = parentPath(path);
  const { ghost, startPress, consumeClick } = useFileMoveDrag(onMove ?? (() => {}), path);

  const activeSelected = selectedPaths ?? (selected ? new Set([selected]) : new Set<string>());

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
    // A plain drag on a row moves the file. Empty space and modifier drags select.
    const rowDragMovesFile = Boolean(clickedPath) && !isCtrlOrMeta && !isShift;

    let dragStarted = false;
    const baseSelection = new Set(activeSelected);

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      if (rowDragMovesFile) return;

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
        return;
      }

      if (rowDragMovesFile) {
        const dist = Math.hypot(upEvent.clientX - initialClientX, upEvent.clientY - initialClientY);
        if (dist >= DRAG_THRESHOLD) return;
      }

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
              data-parent="true"
              {...{ [FILE_DROP_ATTR]: parentDest }}
              className={`cursor-default select-none border-b sui-hairline sui-hover ${ghost?.dest === parentDest ? "bg-sky-500/20 outline-2 outline-sky-400" : ""}`}
              onClick={onParent}
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
              selected={activeSelected.has(entry.path)}
              dropActive={ghost?.dest === entry.path}
              onOpen={() => onOpen(entry)}
              onContextMenu={(event) => onContextMenu(event, entry)}
              onPointerDown={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                startPress(event, entry.path, entry.name, entry.type);
              }}
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
  onOpen,
  onContextMenu,
  onPointerDown,
  consumeClick,
}: {
  entry: FileEntry;
  selected: boolean;
  dropActive: boolean;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  consumeClick: () => boolean;
}) {
  return (
    <tr
      data-path={entry.path}
      {...(entry.type === "dir" ? { [FILE_DROP_ATTR]: entry.path } : {})}
      className={`cursor-default select-none border-b sui-hairline sui-hover ${selected ? "sui-selected" : ""} ${dropActive ? "bg-sky-500/20 outline-2 outline-sky-400" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
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

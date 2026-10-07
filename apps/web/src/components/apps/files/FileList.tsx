"use client";

import { useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { formatModified, formatSize } from "@/src/lib/files/format";
import { parentPath, type FileEntry } from "@/src/lib/api/files";
import { FolderIcon, FinderIcon, kindLabel } from "@/src/components/apps/files/file-icons";
import {
  FILE_DROP_ATTR,
  useFileMoveDrag,
  type FileMoveGhost,
} from "@/src/components/apps/files/use-file-move-drag";
import {
  useMarqueeSelection,
  type MarqueeBox,
} from "@/src/components/apps/files/use-marquee-selection";
import { PageLayer } from "@/src/components/window/window-chrome";

/** Finder list view: striped rows with Name, Date Modified, Size and Kind. */
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
  onClearSelection?: () => void;
  onOpen: (entry: FileEntry) => void;
  onParent: () => void;
  onContextMenu: (event: MouseEvent, entry: FileEntry | null) => void;
  onMove?: (sourcePath: string, destDir: string, sourceType: "file" | "dir") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentDest = parentPath(path);
  const { ghost, startPress, consumeClick } = useFileMoveDrag(onMove ?? (() => {}), path);

  const activeSelected = selectedPaths ?? (selected ? new Set([selected]) : new Set<string>());
  const { marquee, handleMouseDown } = useMarqueeSelection({
    containerRef,
    itemSelector: "tr[data-path]",
    ignoreSelector: "thead, tr[data-parent]",
    selectedPaths: activeSelected,
    onSelect,
    onToggleSelect,
    onSelectRange,
    onSelectionChange,
    onClearSelection,
  });

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 flex-col select-none"
      onMouseDown={handleMouseDown}
      onContextMenu={(event) => {
        onContextMenu(event, null);
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <table className="w-full table-fixed text-left text-[12.5px]">
          <thead className="sui-finder-list-head sticky top-0 z-10 text-[11px]">
            <tr>
              <th className="py-1.5 pr-3 pl-5 font-medium">Name</th>
              <th className="w-[24%] px-3 py-1.5 font-medium">Date Modified</th>
              <th className="w-[13%] px-3 py-1.5 text-right font-medium">Size</th>
              <th className="w-[20%] px-3 py-1.5 font-medium">Kind</th>
            </tr>
          </thead>
          <tbody className="sui-finder-rows">
            {path !== "/" ? (
              <tr
                data-parent="true"
                {...{ [FILE_DROP_ATTR]: parentDest }}
                className="sui-finder-row cursor-default select-none"
                data-drop={ghost?.dest === parentDest}
                onClick={onParent}
                onDoubleClick={onParent}
              >
                <td className="py-[3px] pr-3 pl-5" colSpan={4}>
                  <span className="flex items-center gap-2">
                    <FolderIcon size={18} />
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
        <div aria-hidden className="h-24 shrink-0" />
      </div>
      <FileViewOverlays marquee={marquee} ghost={ghost} />
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
      data-entry-name={entry.name}
      data-selected={selected}
      data-drop={dropActive}
      {...(entry.type === "dir" ? { [FILE_DROP_ATTR]: entry.path } : {})}
      className={`sui-finder-row cursor-default select-none ${selected ? "sui-selected" : ""}`}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
      onDoubleClick={() => {
        if (consumeClick()) return;
        onOpen();
      }}
      onContextMenu={onContextMenu}
    >
      <td className="py-[3px] pr-3 pl-5">
        <span className="flex max-w-full items-center gap-2">
          <FinderIcon entry={entry} size={18} />
          <span className="truncate">{entry.name}</span>
        </span>
      </td>
      <td className="sui-finder-muted px-3 py-[3px] whitespace-nowrap">
        {formatModified(entry.modified)}
      </td>
      <td className="sui-finder-muted px-3 py-[3px] text-right whitespace-nowrap">
        {entry.type === "dir" ? "--" : formatSize(entry.size)}
      </td>
      <td className="sui-finder-muted truncate px-3 py-[3px]">{kindLabel(entry)}</td>
    </tr>
  );
}

/** Rubber-band box and drag label shared by the icon and list views. */
export function FileViewOverlays({
  marquee,
  ghost,
}: {
  marquee: MarqueeBox | null;
  ghost: FileMoveGhost | null;
}) {
  return (
    <>
      {marquee ? (
        <div
          data-testid="selection-marquee"
          className="sui-finder-marquee pointer-events-none absolute z-20 rounded-[3px]"
          style={marquee}
        />
      ) : null}
      {ghost ? (
        <PageLayer>
          <div
            className="pointer-events-none fixed z-[90] max-w-[220px] truncate rounded-md bg-black/80 px-2 py-1 text-[12px] text-white shadow-lg"
            style={{ left: ghost.x + 12, top: ghost.y + 12 }}
          >
            {ghost.name}
          </div>
        </PageLayer>
      ) : null}
    </>
  );
}

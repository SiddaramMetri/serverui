"use client";

import { useRef, type MouseEvent } from "react";
import type { FileEntry } from "@/src/lib/api/files";
import { FinderIcon } from "@/src/components/apps/files/file-icons";
import { FILE_DROP_ATTR, useFileMoveDrag } from "@/src/components/apps/files/use-file-move-drag";
import { useMarqueeSelection } from "@/src/components/apps/files/use-marquee-selection";
import { FileViewOverlays } from "@/src/components/apps/files/FileList";

/** Finder icon view: a wrapping grid of large icons with names underneath. */
export function FileGrid({
  path,
  entries,
  selectedPaths,
  onSelect,
  onToggleSelect,
  onSelectRange,
  onSelectionChange,
  onClearSelection,
  onOpen,
  onContextMenu,
  onMove,
}: {
  path: string;
  entries: FileEntry[];
  selectedPaths: Set<string>;
  onSelect: (path: string, event?: MouseEvent) => void;
  onToggleSelect?: (path: string) => void;
  onSelectRange?: (path: string) => void;
  onSelectionChange?: (paths: Set<string>) => void;
  onClearSelection?: () => void;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (event: MouseEvent, entry: FileEntry | null) => void;
  onMove?: (sourcePath: string, destDir: string, sourceType: "file" | "dir") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ghost, startPress, consumeClick } = useFileMoveDrag(onMove ?? (() => {}), path);
  const { marquee, handleMouseDown } = useMarqueeSelection({
    containerRef,
    itemSelector: "[data-path]",
    selectedPaths,
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
      onContextMenu={(event) => onContextMenu(event, null)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul
          role="listbox"
          aria-label="Files"
          aria-multiselectable="true"
          className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] content-start gap-x-2 gap-y-4 px-5 pt-5 pb-24"
        >
          {entries.map((entry) => {
            const selected = selectedPaths.has(entry.path);
            const dropActive = ghost?.dest === entry.path;
            return (
              <li
                key={entry.path}
                role="option"
                aria-selected={selected}
                data-path={entry.path}
                data-entry-name={entry.name}
                {...(entry.type === "dir" ? { [FILE_DROP_ATTR]: entry.path } : {})}
                className="flex cursor-default flex-col items-center gap-1 text-center"
                onPointerDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                  startPress(event, entry.path, entry.name, entry.type);
                }}
                onDragStart={(event) => event.preventDefault()}
                onDoubleClick={() => {
                  if (consumeClick()) return;
                  onOpen(entry);
                }}
                onContextMenu={(event) => onContextMenu(event, entry)}
              >
                <span
                  className="transition-colors data-[selected=true]:bg-[var(--finder-tile-selected)] flex size-[72px] items-center justify-center rounded-[10px]"
                  data-selected={selected || dropActive}
                >
                  <FinderIcon entry={entry} size={60} />
                </span>
                <span
                  className="data-[selected=true]:bg-[var(--finder-accent)] data-[selected=true]:text-white line-clamp-2 max-w-full rounded-[4px] px-1.5 py-px text-[12px] leading-[15px] break-words"
                  data-selected={selected}
                  title={entry.name}
                >
                  {entry.name}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <FileViewOverlays marquee={marquee} ghost={ghost} />
    </div>
  );
}

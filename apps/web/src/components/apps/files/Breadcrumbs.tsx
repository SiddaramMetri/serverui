"use client";

import { ChevronRight, HardDrive } from "lucide-react";
import { FolderIcon } from "@/src/components/apps/files/file-icons";
import { FILE_DROP_ATTR } from "@/src/components/apps/files/use-file-move-drag";

/** Finder path bar: the server disk, then each folder; segments accept drops. */
export function Breadcrumbs({
  path,
  rootLabel,
  onNavigate,
}: {
  path: string;
  rootLabel: string;
  onNavigate: (next: string) => void;
}) {
  const parts = path === "/" ? [] : path.split("/").filter(Boolean);

  return (
    <nav
      aria-label="Location"
      className="flex min-w-0 flex-1 items-center overflow-x-auto text-[11.5px] [scrollbar-width:none]"
    >
      <button
        type="button"
        {...{ [FILE_DROP_ATTR]: "/" }}
        className="hover:bg-[var(--finder-nav-hover)] flex shrink-0 items-center gap-1 rounded px-1 py-0.5 outline-none"
        onClick={() => onNavigate("/")}
      >
        <HardDrive aria-hidden className="sui-finder-muted size-3.5" strokeWidth={1.8} />
        {rootLabel}
      </button>
      {parts.map((part, index) => {
        const target = `/${parts.slice(0, index + 1).join("/")}`;
        return (
          <span key={target} className="flex min-w-0 shrink-0 items-center">
            <ChevronRight aria-hidden className="sui-finder-muted size-3 shrink-0" />
            <button
              type="button"
              {...{ [FILE_DROP_ATTR]: target }}
              className="hover:bg-[var(--finder-nav-hover)] flex max-w-[180px] items-center gap-1 rounded px-1 py-0.5 outline-none"
              onClick={() => onNavigate(target)}
            >
              <FolderIcon size={14} />
              <span className="truncate">{part}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}

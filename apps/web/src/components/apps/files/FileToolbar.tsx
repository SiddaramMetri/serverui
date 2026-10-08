"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  Trash2,
} from "lucide-react";
import { MenuList, type MenuEntry } from "@/src/components/apps/files/FileContextMenu";
import { PageLayer, useTitlebarProps } from "@/src/components/window/window-chrome";

export type FilesView = "icons" | "list";

/** Small text buttons in the Files sheets, banners and download panel. */
export const toolbarClass =
  "sui-hover inline-flex items-center gap-1 rounded-md px-2 py-1 sui-muted outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40";

/** Finder-style unified toolbar; doubles as the window's drag region. */
export function FileToolbar({
  title,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  view,
  onViewChange,
  selectedCount,
  query,
  onQueryChange,
  onUploadClick,
  onNewFolder,
  onNewFile,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onSelectAll,
  onClearSelection,
  onCopyPath,
  onTerminalHere,
}: {
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  view: FilesView;
  onViewChange: (view: FilesView) => void;
  selectedCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  onUploadClick: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCopyPath: () => void;
  onTerminalHere: () => void;
}) {
  const titlebar = useTitlebarProps();
  const none = selectedCount === 0;
  const single = selectedCount === 1;

  const menu: MenuEntry[] = [
    { label: "New Folder", run: onNewFolder },
    { label: "New File", run: onNewFile },
    { label: "Upload…", run: onUploadClick },
    "separator",
    { label: "Open", run: onOpen, disabled: !single },
    { label: "Download", run: onDownload, disabled: none },
    { label: "Rename", run: onRename, disabled: !single },
    { label: "Delete", run: onDelete, disabled: none, destructive: true },
    "separator",
    none
      ? { label: "Select All", run: onSelectAll }
      : { label: "Clear Selection", run: onClearSelection },
    { label: "Copy Path", run: onCopyPath },
    { label: "Open Terminal Here", run: onTerminalHere },
  ];

  return (
    <div
      className="sui-finder-toolbar flex h-[52px] shrink-0 items-center gap-3 pr-3 pl-2 select-none"
      {...titlebar}
    >
      <div className="flex items-center">
        <ToolbarIconButton label="Back" disabled={!canGoBack} onClick={onBack} plain>
          <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={2} />
        </ToolbarIconButton>
        <ToolbarIconButton label="Forward" disabled={!canGoForward} onClick={onForward} plain>
          <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2} />
        </ToolbarIconButton>
      </div>
      <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</h2>
      <div
        role="radiogroup"
        aria-label="View"
        className="sui-finder-segment flex shrink-0 items-center rounded-[9px] p-[2px]"
      >
        <SegmentButton
          label="Icon view"
          active={view === "icons"}
          onClick={() => onViewChange("icons")}
        >
          <LayoutGrid aria-hidden className="size-[14px]" />
        </SegmentButton>
        <SegmentButton
          label="List view"
          active={view === "list"}
          onClick={() => onViewChange("list")}
        >
          <List aria-hidden className="size-[14px]" />
        </SegmentButton>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ToolbarIconButton label="Upload" onClick={onUploadClick}>
          <ArrowUpFromLine aria-hidden className="size-[14px]" />
        </ToolbarIconButton>
        <ToolbarIconButton label="New folder" onClick={onNewFolder}>
          <FolderPlus aria-hidden className="size-[14px]" />
        </ToolbarIconButton>
        <ToolbarIconButton label="Download" disabled={none} onClick={onDownload}>
          <ArrowDownToLine aria-hidden className="size-[14px]" />
        </ToolbarIconButton>
        <ToolbarIconButton label="Delete" disabled={none} onClick={onDelete}>
          <Trash2 aria-hidden className="size-[14px]" />
        </ToolbarIconButton>
        <MoreMenu actions={menu} />
      </div>
      <label className="relative flex shrink-0 items-center">
        <Search
          aria-hidden
          className="sui-finder-muted pointer-events-none absolute left-2.5 size-[13px]"
        />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
          aria-label="Search"
          className="sui-finder-search w-44 rounded-full py-[5px] pr-3 pl-8 text-[12px] outline-none"
        />
      </label>
    </div>
  );
}

function ToolbarIconButton({
  label,
  disabled,
  plain,
  tooltip = true,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  plain?: boolean;
  tooltip?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <WithTooltip label={label} show={tooltip}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        className={`${plain ? "sui-finder-plain-button" : "sui-finder-control"} flex items-center justify-center rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-35 ${
          plain ? "size-7" : "h-[28px] w-[30px]"
        }`}
        onClick={onClick}
      >
        {children}
      </button>
    </WithTooltip>
  );
}

/** macOS-style hover label under a toolbar control (shown after a short delay, or on keyboard focus). */
function WithTooltip({
  label,
  show = true,
  children,
}: {
  label: string;
  show?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="group/tip relative flex">
      {children}
      {show ? (
        <span aria-hidden className="sui-toolbar-tip">
          {label}
        </span>
      ) : null}
    </span>
  );
}

function SegmentButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <WithTooltip label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={label}
        data-active={active}
        className="sui-finder-segment-button flex h-[22px] w-[28px] items-center justify-center rounded-[7px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        onClick={onClick}
      >
        {children}
      </button>
    </WithTooltip>
  );
}

function MoreMenu({ actions }: { actions: MenuEntry[] }) {
  // Viewport position of the open menu; rendered on <body> so the window's
  // overflow and backdrop-filter cannot clip or offset it.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setAnchor(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAnchor(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor]);

  function toggle() {
    const rect = buttonRef.current?.getBoundingClientRect();
    setAnchor(
      anchor || !rect ? null : { top: rect.bottom + 6, right: window.innerWidth - rect.right },
    );
  }

  return (
    <div ref={buttonRef}>
      <ToolbarIconButton label="More actions" tooltip={!anchor} onClick={toggle}>
        <Ellipsis aria-hidden className="size-[15px]" />
      </ToolbarIconButton>
      {anchor ? (
        <PageLayer>
          <div ref={menuRef} className="fixed z-[80]" style={anchor}>
            <MenuList label="More actions" actions={actions} onClose={() => setAnchor(null)} />
          </div>
        </PageLayer>
      ) : null}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
import type { FileEntry } from "@/src/lib/api/files";
import { PageLayer } from "@/src/components/window/window-chrome";

export type MenuAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export type MenuEntry = MenuAction | "separator";

type FileContextMenuProps = {
  x: number;
  y: number;
  entry: FileEntry | null;
  selectedEntries?: FileEntry[];
  onOpen: () => void;
  onDownload?: () => void;
  onExtractHere?: () => void;
  onExtractTo?: () => void;
  onDelete?: () => void;
  onCopyPath: () => void;
  onInfo: () => void;
  onTerminalHere: () => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onUpload?: () => void;
  onClearSelection?: () => void;
  onClose: () => void;
};

export function FileContextMenu({
  x,
  y,
  entry,
  selectedEntries = [],
  onOpen,
  onDownload,
  onExtractHere,
  onExtractTo,
  onDelete,
  onCopyPath,
  onInfo,
  onTerminalHere,
  onNewFolder,
  onNewFile,
  onUpload,
  onClearSelection,
  onClose,
}: FileContextMenuProps) {
  const count = selectedEntries.length;
  const isDir = !entry || entry.type === "dir";
  const action = (label: string, onSelect?: () => void): MenuAction[] =>
    onSelect ? [{ label, onSelect }] : [];

  const actions: MenuEntry[] =
    count > 1
      ? [
          ...action(`Download (${count} items)`, onDownload),
          ...action(`Delete (${count} items)`, onDelete),
          "separator",
          ...action("Copy Paths", onCopyPath),
          ...action("Clear Selection", onClearSelection),
        ]
      : [
          ...(!entry
            ? [
                ...action("New Folder", onNewFolder),
                ...action("New File", onNewFile),
                ...action("Upload…", onUpload),
                "separator" as const,
              ]
            : []),
          ...action("Open", onOpen),
          ...(isDir
            ? action("Open Terminal Here", onTerminalHere)
            : action("Download", onDownload)),
          ...action("Extract Here", onExtractHere),
          ...action("Extract To…", onExtractTo),
          ...(entry ? action("Delete", onDelete) : []),
          "separator",
          ...action("Copy Path", onCopyPath),
          ...(entry ? action(isDir ? "Folder Information" : "File Information", onInfo) : []),
        ];

  return (
    <PageLayer>
      <MenuList
        label="File actions"
        actions={actions}
        onClose={onClose}
        className="fixed"
        style={{ left: x, top: y }}
      />
    </PageLayer>
  );
}

/** macOS-style menu body shared by the context menu and the toolbar's more menu. */
export function MenuList({
  label,
  actions,
  onClose,
  className = "",
  style,
}: {
  label: string;
  actions: MenuEntry[];
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={`sui-menu z-[80] min-w-52 overflow-hidden rounded-[10px] border p-1 text-[13px] shadow-2xl animate-menu-in backdrop-blur-xl ${className}`}
      style={style}
    >
      {actions.map((item, index) =>
        item === "separator" ? (
          <div key={`separator-${index}`} className="mx-2 my-1 h-px bg-black/10 dark:bg-white/10" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`block w-full rounded-[5px] px-2.5 py-[3px] text-left outline-none enabled:hover:bg-[var(--finder-accent)] enabled:hover:text-white focus-visible:bg-[var(--finder-accent)] focus-visible:text-white disabled:opacity-40 ${
              item.destructive ? "text-red-500" : ""
            }`}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

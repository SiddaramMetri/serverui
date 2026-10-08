"use client";

import { isArchive, type FileEntry } from "@/src/lib/api/files";

export type FileMenuActions = {
  onOpen: () => void;
  onTerminalHere: () => void;
  onCopyPath: () => void;
  onInfo: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onCompress: () => void;
  onExtract: () => void;
};

type FileContextMenuProps = FileMenuActions & {
  x: number;
  y: number;
  entry: FileEntry | null;
  selectedEntries?: FileEntry[];
  canPaste: boolean;
  onClose: () => void;
};

type Item = { label: string; run: () => void; disabled?: boolean } | "separator";

export function menuItems({
  entry,
  selectedEntries = [],
  canPaste,
  ...a
}: Omit<FileContextMenuProps, "x" | "y" | "onClose">): Item[] {
  if (!entry) {
    return [
      { label: "Open Terminal", run: a.onTerminalHere },
      { label: "Paste", run: a.onPaste, disabled: !canPaste },
    ];
  }

  if (selectedEntries.length > 1) {
    const onlyFiles = selectedEntries.every((item) => item.type === "file");
    const n = selectedEntries.length;
    return [
      { label: `Copy (${n} items)`, run: a.onCopy },
      { label: `Cut (${n} items)`, run: a.onCut },
      { label: `Delete (${n} items)`, run: a.onDelete },
      "separator",
      { label: `Compress (${n} items)`, run: a.onCompress },
      ...(onlyFiles ? [{ label: `Download (${n} items)`, run: a.onDownload }] : []),
    ];
  }

  const dir = entry.type === "dir";
  const archive = isArchive(entry);
  return [
    { label: "Open", run: a.onOpen },
    ...(dir ? [{ label: "Open Terminal", run: a.onTerminalHere }] : []),
    { label: "Copy Path", run: a.onCopyPath },
    { label: "Details", run: a.onInfo },
    ...(dir ? [] : [{ label: "Download", run: a.onDownload }]),
    "separator",
    { label: "Rename", run: a.onRename },
    { label: "Delete", run: a.onDelete },
    "separator",
    { label: "Copy", run: a.onCopy },
    { label: "Cut", run: a.onCut },
    archive ? { label: "Extract", run: a.onExtract } : { label: "Compress", run: a.onCompress },
  ];
}

export function FileContextMenu({ x, y, onClose, ...props }: FileContextMenuProps) {
  return (
    <div
      role="menu"
      aria-label="File actions"
      className="sui-menu fixed z-[80] min-w-48 overflow-hidden rounded-xl border py-1 text-sm shadow-2xl animate-menu-in backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {menuItems(props).map((item, index) =>
        item === "separator" ? (
          <div key={`sep-${index}`} className="my-1 h-px bg-black/8 dark:bg-white/10" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className="block w-full px-3 py-1.5 text-left outline-none hover:bg-sky-500 hover:text-white focus-visible:bg-sky-500 focus-visible:text-white disabled:pointer-events-none disabled:opacity-40"
            onClick={() => {
              item.run();
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

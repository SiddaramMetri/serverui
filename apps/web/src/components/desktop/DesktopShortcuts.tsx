"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { FilesMacIcon } from "@/src/components/desktop/mac-icons";
import { useWindowManager } from "@/src/components/window/window-context";
import { removeDesktopShortcut, useDesktopShortcuts } from "@/src/lib/desktop-shortcuts";

export function DesktopShortcuts({ serverId }: { serverId: string }) {
  const shortcuts = useDesktopShortcuts(serverId);
  const { openWindow } = useWindowManager();
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  if (!shortcuts.length) return null;

  function open(path: string) {
    openWindow("files", { cwd: path });
  }

  function onContextMenu(event: MouseEvent, path: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY - 32, path });
  }

  return (
    <>
      <ul className="absolute right-4 top-4 flex max-h-[calc(100%-8rem)] flex-col flex-wrap-reverse gap-2">
        {shortcuts.map((path) => (
          <li key={path}>
            <button
              type="button"
              title={path}
              className="flex w-20 flex-col items-center gap-1 rounded-lg p-1.5 text-white outline-none hover:bg-white/15 focus-visible:bg-white/25"
              onDoubleClick={() => open(path)}
              onKeyDown={(event) => {
                if (event.key === "Enter") open(path);
              }}
              onContextMenu={(event) => onContextMenu(event, path)}
            >
              <FilesMacIcon className="size-12" />
              <span className="line-clamp-2 break-all text-center text-[12px] leading-4 drop-shadow">
                {path.split("/").filter(Boolean).pop() || "/"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {menu ? (
        <div
          role="menu"
          aria-label="Shortcut"
          className="sui-menu absolute z-[80] min-w-44 overflow-hidden rounded-xl border py-1 text-sm shadow-2xl animate-menu-in backdrop-blur-xl"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MenuItem
            label="Open"
            onSelect={() => {
              open(menu.path);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Remove from Desktop"
            onSelect={() => {
              removeDesktopShortcut(serverId, menu.path);
              setMenu(null);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function MenuItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full px-3 py-1.5 text-left outline-none hover:bg-sky-500 hover:text-white focus-visible:bg-sky-500 focus-visible:text-white"
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

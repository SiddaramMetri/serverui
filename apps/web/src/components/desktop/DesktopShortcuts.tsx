"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { FilesMacIcon } from "@/src/components/desktop/mac-icons";
import { useWindowManager } from "@/src/components/window/window-context";
import {
  layoutShortcuts,
  moveShortcut,
  removeDesktopShortcut,
  saveDesktopShortcuts,
  useDesktopShortcuts,
} from "@/src/lib/desktop-shortcuts";

const CELL_W = 92;
const CELL_H = 96;
const PAD = 8;
const DRAG_THRESHOLD = 4;

type Drag = {
  path: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
};

export function DesktopShortcuts({ serverId }: { serverId: string }) {
  const shortcuts = useDesktopShortcuts(serverId);
  const { openWindow } = useWindowManager();
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  // Keep the dock's strip at the bottom free of icons.
  const cols = Math.floor((size.width - PAD * 2) / CELL_W);
  const rows = Math.floor((size.height - PAD * 2 - 80) / CELL_H);
  const cells = layoutShortcuts(shortcuts, cols, rows);

  function open(path: string) {
    openWindow("files", { cwd: path });
  }

  function onContextMenu(event: MouseEvent, path: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, path });
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, path: string) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ path, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false });
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    setDrag({ ...drag, dx, dy, moved });
  }

  function onPointerUp() {
    if (!drag) return;
    const from = cells.get(drag.path);
    setDrag(null);
    if (!drag.moved || !from) return;
    const target = {
      col: clamp(Math.round(from.col + drag.dx / CELL_W), 0, Math.max(0, cols - 1)),
      row: clamp(Math.round(from.row + drag.dy / CELL_H), 0, Math.max(0, rows - 1)),
    };
    saveDesktopShortcuts(serverId, moveShortcut(shortcuts, cells, drag.path, target));
  }

  return (
    <div ref={areaRef} className="pointer-events-none absolute inset-0">
      {shortcuts.map(({ path }) => {
        const cell = cells.get(path) ?? { col: 0, row: 0 };
        const dragging = drag?.path === path && drag.moved;
        return (
          <button
            key={path}
            type="button"
            title={path}
            className={`pointer-events-auto absolute flex w-20 touch-none select-none flex-col items-center gap-1 rounded-lg p-1.5 text-white outline-none hover:bg-white/15 focus-visible:bg-white/25 ${
              dragging
                ? "z-10 cursor-grabbing bg-white/20 opacity-90"
                : "transition-[left,top] duration-150"
            }`}
            style={{
              left: PAD + cell.col * CELL_W + (dragging ? drag.dx : 0),
              top: PAD + cell.row * CELL_H + (dragging ? drag.dy : 0),
            }}
            onPointerDown={(event) => onPointerDown(event, path)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
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
        );
      })}
      {menu ? (
        <div
          role="menu"
          aria-label="Shortcut"
          className="sui-menu pointer-events-auto fixed z-[80] min-w-44 overflow-hidden rounded-xl border py-1 text-sm shadow-2xl animate-menu-in backdrop-blur-xl"
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
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
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

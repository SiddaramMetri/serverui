"use client";

import { useSyncExternalStore } from "react";

export type DesktopShortcut = { path: string; col?: number; row?: number };
export type Cell = { col: number; row: number };

const KEY_PREFIX = "serverui-desktop-shortcuts:";
const EVENT = "serverui-desktop-shortcuts";
const EMPTY: DesktopShortcut[] = [];

let cacheKey = "";
let cacheRaw: string | null = null;
let cache: DesktopShortcut[] = EMPTY;

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

const isCell = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

// Accepts the first format (a plain list of paths) and the current one ({ path, col, row }).
export function parseShortcuts(raw: string | null): DesktopShortcut[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const seen = new Set<string>();
    const out: DesktopShortcut[] = [];
    for (const item of parsed) {
      const value = typeof item === "string" ? { path: item } : (item as DesktopShortcut | null);
      if (!value || typeof value.path !== "string" || !value.path.startsWith("/")) continue;
      if (seen.has(value.path)) continue;
      seen.add(value.path);
      out.push(
        isCell(value.col) && isCell(value.row)
          ? { path: value.path, col: value.col, row: value.row }
          : { path: value.path },
      );
    }
    return out;
  } catch {
    return EMPTY;
  }
}

/**
 * Resolves every shortcut to a grid cell. Saved cells win (clamped to the grid, first come first
 * served); the rest fill free cells top to bottom, starting from the rightmost column.
 */
export function layoutShortcuts(items: DesktopShortcut[], cols: number, rows: number) {
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const taken = new Set<string>();
  const cells = new Map<string, Cell>();
  const key = (cell: Cell) => `${cell.col}:${cell.row}`;

  for (const item of items) {
    if (item.col === undefined || item.row === undefined) continue;
    const cell = { col: Math.min(item.col, c - 1), row: Math.min(item.row, r - 1) };
    if (taken.has(key(cell))) continue;
    taken.add(key(cell));
    cells.set(item.path, cell);
  }
  let col = c - 1;
  let row = 0;
  for (const item of items) {
    if (cells.has(item.path)) continue;
    // ponytail: past a full grid, extra icons stack on the last cell; a bigger grid is the fix.
    while (taken.has(`${col}:${row}`) && col >= 0) {
      row += 1;
      if (row >= r) {
        row = 0;
        col -= 1;
      }
    }
    const cell = col >= 0 ? { col, row } : { col: 0, row: r - 1 };
    taken.add(key(cell));
    cells.set(item.path, cell);
  }
  return cells;
}

/** Places `path` on `target`; whoever sat there takes the dragged icon's old cell. */
export function moveShortcut(
  items: DesktopShortcut[],
  cells: Map<string, Cell>,
  path: string,
  target: Cell,
): DesktopShortcut[] {
  const from = cells.get(path);
  return items.map((item) => {
    const cell = cells.get(item.path);
    if (item.path === path) return { path, ...target };
    if (cell && from && cell.col === target.col && cell.row === target.row) {
      return { path: item.path, ...from };
    }
    return cell ? { path: item.path, ...cell } : item;
  });
}

function read(serverId: string): DesktopShortcut[] {
  if (!serverId) return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY_PREFIX + serverId);
  } catch {
    // Ignore private-mode storage failures.
  }
  if (serverId === cacheKey && raw === cacheRaw) return cache;
  cacheKey = serverId;
  cacheRaw = raw;
  cache = parseShortcuts(raw);
  return cache;
}

export function saveDesktopShortcuts(serverId: string, items: DesktopShortcut[]) {
  if (!serverId) return;
  try {
    localStorage.setItem(KEY_PREFIX + serverId, JSON.stringify(items));
  } catch {
    // Ignore private-mode storage failures.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addDesktopShortcut(serverId: string, path: string) {
  const current = read(serverId);
  if (!current.some((item) => item.path === path))
    saveDesktopShortcuts(serverId, [...current, { path }]);
}

export function removeDesktopShortcut(serverId: string, path: string) {
  saveDesktopShortcuts(
    serverId,
    read(serverId).filter((item) => item.path !== path),
  );
}

export function useDesktopShortcuts(serverId: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(serverId),
    () => EMPTY,
  );
}

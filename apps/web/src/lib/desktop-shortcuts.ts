"use client";

import { useSyncExternalStore } from "react";

const KEY_PREFIX = "serverui-desktop-shortcuts:";
const EVENT = "serverui-desktop-shortcuts";
const EMPTY: string[] = [];

let cacheKey = "";
let cacheRaw: string | null = null;
let cache: string[] = EMPTY;

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function parseShortcuts(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    return [
      ...new Set(
        parsed.filter((item): item is string => typeof item === "string" && item.startsWith("/")),
      ),
    ];
  } catch {
    return EMPTY;
  }
}

function read(serverId: string): string[] {
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

function write(serverId: string, paths: string[]) {
  try {
    localStorage.setItem(KEY_PREFIX + serverId, JSON.stringify(paths));
  } catch {
    // Ignore private-mode storage failures.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addDesktopShortcut(serverId: string, path: string) {
  if (!serverId) return;
  const current = read(serverId);
  if (!current.includes(path)) write(serverId, [...current, path]);
}

export function removeDesktopShortcut(serverId: string, path: string) {
  if (!serverId) return;
  write(
    serverId,
    read(serverId).filter((item) => item !== path),
  );
}

export function useDesktopShortcuts(serverId: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(serverId),
    () => EMPTY,
  );
}

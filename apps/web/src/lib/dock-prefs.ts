"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { APP_IDS, type DockAppId } from "@/src/data/apps";

export type DockHideMode = "always" | "auto";

const HIDE_KEY = "serverui-dock-autohide";
const ORDER_KEY = "serverui-dock-order";
const PREFS_EVENT = "serverui-dock-prefs";

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PREFS_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(PREFS_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(PREFS_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

let hideCache: DockHideMode = "always";
let orderCache: DockAppId[] = [...APP_IDS];
let orderRaw = "";

function readHideMode(): DockHideMode {
  try {
    hideCache = localStorage.getItem(HIDE_KEY) === "auto" ? "auto" : "always";
  } catch {
    hideCache = "always";
  }
  return hideCache;
}

function parseOrder(raw: string | null): DockAppId[] {
  const key = raw ?? "";
  if (key === orderRaw && orderCache.length) return orderCache;
  orderRaw = key;
  if (!raw) {
    orderCache = [...APP_IDS];
    return orderCache;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      orderCache = [...APP_IDS];
      return orderCache;
    }
    const allowed = new Set<string>(APP_IDS);
    const next: DockAppId[] = [];
    for (const item of parsed) {
      if (typeof item === "string" && allowed.has(item) && !next.includes(item as DockAppId)) {
        next.push(item as DockAppId);
      }
    }
    for (const id of APP_IDS) {
      if (!next.includes(id)) next.push(id);
    }
    orderCache = next;
    return orderCache;
  } catch {
    orderCache = [...APP_IDS];
    return orderCache;
  }
}

function readOrder(): DockAppId[] {
  try {
    return parseOrder(localStorage.getItem(ORDER_KEY));
  } catch {
    return parseOrder(null);
  }
}

export function setDockHideMode(mode: DockHideMode) {
  try {
    localStorage.setItem(HIDE_KEY, mode);
  } catch {
    // Ignore private-mode storage failures.
  }
  emit();
}

export function setDockOrder(order: DockAppId[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(readOrderFromList(order)));
  } catch {
    // Ignore private-mode storage failures.
  }
  orderRaw = "";
  emit();
}

function readOrderFromList(order: DockAppId[]) {
  const allowed = new Set<string>(APP_IDS);
  const next: DockAppId[] = [];
  for (const item of order) {
    if (allowed.has(item) && !next.includes(item)) next.push(item);
  }
  for (const id of APP_IDS) {
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function useDockPrefs() {
  const hideMode = useSyncExternalStore(subscribe, readHideMode, () => "always" as DockHideMode);
  const order = useSyncExternalStore(subscribe, readOrder, (): DockAppId[] => orderCache);

  const setHideMode = useCallback((mode: DockHideMode) => {
    setDockHideMode(mode);
  }, []);

  const setOrder = useCallback((next: DockAppId[]) => {
    setDockOrder(next);
  }, []);

  return useMemo(
    () => ({ hideMode, order, setHideMode, setOrder }),
    [hideMode, order, setHideMode, setOrder],
  );
}

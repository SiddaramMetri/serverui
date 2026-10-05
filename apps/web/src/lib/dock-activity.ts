"use client";

import { useSyncExternalStore } from "react";
import type { DockAppId } from "@/src/data/apps";

type ActivityState = {
  badges: Partial<Record<DockAppId | "trash", number>>;
  trashHasItems: boolean;
};

const EVENT = "serverui-dock-activity";

let state: ActivityState = {
  badges: {},
  trashHasItems: false,
};

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  return () => window.removeEventListener(EVENT, onStoreChange);
}

function snapshot() {
  return state;
}

export function setDockBadge(app: DockAppId | "trash", count: number) {
  const next = Math.max(0, Math.round(count));
  if (state.badges[app] === next) return;
  state = {
    ...state,
    badges: { ...state.badges, [app]: next },
  };
  emit();
}

export function setDockTrashHasItems(hasItems: boolean) {
  state = { ...state, trashHasItems: hasItems };
  emit();
}

export function formatDockBadge(count: number) {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}

export function useDockActivity() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

"use client";

import { createContext, useContext, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { WindowTrafficLights } from "@/src/components/window/WindowHeader";

/**
 * Lets an app with a unified title bar (APP_META unifiedTitlebar) draw the
 * window controls itself and turn its own toolbar into the drag region.
 */
export type WindowChromeValue = {
  focused: boolean;
  maximized: boolean;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

const WindowChromeContext = createContext<WindowChromeValue | null>(null);

export const WindowChromeProvider = WindowChromeContext.Provider;

const INTERACTIVE = "button, a, input, select, textarea, [role=menu], [data-no-drag]";

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE));
}

/**
 * Props that make an element behave like a title bar: drag to move the window,
 * double-click to zoom. Clicks on buttons and inputs inside it are left alone.
 * Outside a window (tests, previews) it returns no handlers.
 */
export function useTitlebarProps() {
  const chrome = useContext(WindowChromeContext);
  if (!chrome) return {};
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (isInteractive(event.target)) return;
      chrome.onDragStart(event);
    },
    onDoubleClick(event: { target: EventTarget | null }) {
      if (isInteractive(event.target)) return;
      chrome.onMaximize();
    },
  };
}

/** Traffic lights for an app-drawn title bar; renders nothing outside a window. */
export function TitlebarTrafficLights() {
  const chrome = useContext(WindowChromeContext);
  return chrome ? <WindowTrafficLights {...chrome} /> : null;
}

/**
 * Renders cursor-positioned UI (context menus, drag labels) on document.body.
 * Windows use backdrop-filter, which makes them the containing block for
 * position: fixed descendants, so viewport coordinates would land offset by
 * the window's position if these stayed inside the window.
 */
export function PageLayer({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

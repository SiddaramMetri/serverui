"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export const FILE_DROP_ATTR = "data-file-drop";

const THRESHOLD = 5;

export type FileMoveGhost = {
  name: string;
  x: number;
  y: number;
  dest: string | null;
};

export function destAtPoint(x: number, y: number, source: string, currentPath?: string) {
  const node =
    typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
  const hit = node instanceof Element ? node.closest(`[${FILE_DROP_ATTR}]`) : null;
  const dest = hit?.getAttribute(FILE_DROP_ATTR);
  if (!dest || dest === source) return null;
  const current = currentPath?.replace(/\/+$/, "") || currentPath;
  const normalizedDest = dest.replace(/\/+$/, "") || "/";
  if (current && (normalizedDest === current || (current === "/" && dest === "/"))) return null;
  return dest;
}

export function useFileMoveDrag(
  onMove: (sourcePath: string, destDir: string, sourceType: "file" | "dir") => void,
  currentPath?: string,
) {
  const onMoveRef = useRef(onMove);
  const currentPathRef = useRef(currentPath);
  const press = useRef<{
    source: string;
    name: string;
    type: "file" | "dir";
    x: number;
    y: number;
  } | null>(null);
  const dragging = useRef(false);
  const skipClick = useRef(false);
  const [ghost, setGhost] = useState<FileMoveGhost | null>(null);

  function startPress(
    event: ReactPointerEvent,
    source: string,
    name: string,
    type: "file" | "dir",
  ) {
    if (event.button !== 0) return;
    press.current = { source, name, type, x: event.clientX, y: event.clientY };
    dragging.current = false;
  }

  function consumeClick() {
    if (!skipClick.current) return false;
    skipClick.current = false;
    return true;
  }

  useEffect(() => {
    onMoveRef.current = onMove;
    currentPathRef.current = currentPath;
  }, [onMove, currentPath]);

  useEffect(() => {
    function onMovePointer(event: MouseEvent) {
      const start = press.current;
      if (!start) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (!dragging.current) {
        if (distance < THRESHOLD) return;
        dragging.current = true;
        document.body.classList.add("select-none");
      }
      event.preventDefault();
      setGhost({
        name: start.name,
        x: event.clientX,
        y: event.clientY,
        dest: destAtPoint(event.clientX, event.clientY, start.source, currentPathRef.current),
      });
    }

    function onUp(event: MouseEvent) {
      const start = press.current;
      press.current = null;
      document.body.classList.remove("select-none");
      if (!start) return;
      if (!dragging.current) {
        setGhost(null);
        return;
      }
      const dest = destAtPoint(event.clientX, event.clientY, start.source, currentPathRef.current);
      dragging.current = false;
      skipClick.current = true;
      setGhost(null);
      if (dest) onMoveRef.current(start.source, dest, start.type);
    }

    window.addEventListener("pointermove", onMovePointer, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("mousemove", onMovePointer);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("mousemove", onMovePointer);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("select-none");
    };
  }, []);

  return { ghost, startPress, consumeClick };
}

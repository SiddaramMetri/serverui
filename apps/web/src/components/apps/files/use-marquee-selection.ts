"use client";

import { useState, type MouseEvent, type RefObject } from "react";

export type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const DRAG_THRESHOLD = 5;

type Options = {
  containerRef: RefObject<HTMLElement | null>;
  /** Selector for selectable items; each must carry data-path. */
  itemSelector: string;
  selectedPaths: Set<string>;
  /** Mouse-downs inside elements matching this selector are ignored. */
  ignoreSelector?: string;
  onSelect: (path: string, event?: MouseEvent) => void;
  onToggleSelect?: (path: string) => void;
  onSelectRange?: (path: string) => void;
  onSelectionChange?: (paths: Set<string>) => void;
  onClearSelection?: () => void;
};

/**
 * Click, modifier-click and rubber-band selection shared by the list and icon
 * views. A plain drag that starts on an item is left to the move-drag hook.
 */
export function useMarqueeSelection({
  containerRef,
  itemSelector,
  selectedPaths,
  ignoreSelector,
  onSelect,
  onToggleSelect,
  onSelectRange,
  onSelectionChange,
  onClearSelection,
}: Options) {
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  function handleMouseDown(e: MouseEvent<HTMLElement>) {
    if (e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (ignoreSelector && target.closest(ignoreSelector)) return;

    const item = target.closest(itemSelector) as HTMLElement | null;
    const clickedPath = item?.getAttribute("data-path") ?? null;

    const initialClientX = e.clientX;
    const initialClientY = e.clientY;

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    // A plain drag on an item moves the file. Empty space and modifier drags select.
    const itemDragMovesFile = Boolean(clickedPath) && !isCtrlOrMeta && !isShift;

    let dragStarted = false;
    const baseSelection = new Set(selectedPaths);

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      if (itemDragMovesFile) return;

      const dist = Math.hypot(
        moveEvent.clientX - initialClientX,
        moveEvent.clientY - initialClientY,
      );

      if (!dragStarted && dist > 4) {
        dragStarted = true;
        document.body.style.userSelect = "none";
      }

      if (dragStarted && container) {
        const containerRect = container.getBoundingClientRect();

        const boxLeft = Math.min(initialClientX, moveEvent.clientX);
        const boxRight = Math.max(initialClientX, moveEvent.clientX);
        const boxTop = Math.min(initialClientY, moveEvent.clientY);
        const boxBottom = Math.max(initialClientY, moveEvent.clientY);

        setMarquee({
          left: boxLeft - containerRect.left,
          top: boxTop - containerRect.top,
          width: boxRight - boxLeft,
          height: boxBottom - boxTop,
        });

        const intersectingPaths = new Set<string>();
        container.querySelectorAll<HTMLElement>(itemSelector).forEach((node) => {
          const nodePath = node.getAttribute("data-path");
          if (!nodePath) return;
          const rect = node.getBoundingClientRect();
          if (
            boxLeft < rect.right &&
            boxRight > rect.left &&
            boxTop < rect.bottom &&
            boxBottom > rect.top
          ) {
            intersectingPaths.add(nodePath);
          }
        });

        if (isCtrlOrMeta) {
          const next = new Set(baseSelection);
          intersectingPaths.forEach((p) => {
            if (baseSelection.has(p)) {
              next.delete(p);
            } else {
              next.add(p);
            }
          });
          onSelectionChange?.(next);
        } else {
          onSelectionChange?.(intersectingPaths);
        }
      }
    }

    function handleMouseUp(upEvent: globalThis.MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";

      if (dragStarted) {
        setMarquee(null);
        return;
      }

      if (itemDragMovesFile) {
        const dist = Math.hypot(upEvent.clientX - initialClientX, upEvent.clientY - initialClientY);
        if (dist >= DRAG_THRESHOLD) return;
      }

      if (clickedPath) {
        if (isShift) {
          onSelectRange?.(clickedPath);
        } else if (isCtrlOrMeta) {
          onToggleSelect?.(clickedPath);
        } else {
          onSelect(clickedPath, upEvent as unknown as MouseEvent);
        }
      } else {
        onClearSelection?.();
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return { marquee, handleMouseDown };
}

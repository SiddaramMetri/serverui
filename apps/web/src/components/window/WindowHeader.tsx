"use client";

import type { PointerEvent, ReactNode } from "react";
import type { WindowChrome } from "@/src/data/apps";

type WindowHeaderProps = {
  title: string;
  focused: boolean;
  chrome: WindowChrome;
  maximized: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
};

export function WindowHeader({
  title,
  focused,
  chrome,
  maximized,
  onPointerDown,
  onDoubleClick,
  onMinimize,
  onMaximize,
  onClose,
}: WindowHeaderProps) {
  const light = chrome === "light";

  return (
    <header
      className={`sui-window-header relative flex h-11 shrink-0 cursor-grab items-center px-3 select-none active:cursor-grabbing ${
        focused ? "" : "opacity-80"
      }`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <WindowTrafficLights
        focused={focused}
        maximized={maximized}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />
      <h2
        className={`pointer-events-none absolute inset-x-16 truncate text-center text-[13px] font-medium ${
          light ? "text-[var(--window-title)]" : "text-white/80"
        }`}
      >
        {title}
      </h2>
    </header>
  );
}

/** Close / minimize / zoom buttons, shared by the standard header and app-drawn title bars. */
export function WindowTrafficLights({
  focused,
  maximized,
  onMinimize,
  onMaximize,
  onClose,
}: {
  focused: boolean;
  maximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <div className="group/traffic z-10 flex items-center gap-2">
      <TrafficLight
        label="Close"
        className={
          focused
            ? "bg-[#ff5f57] text-[#5c0a04]"
            : "bg-[var(--traffic-idle)] text-[#5c0a04] group-hover/traffic:bg-[#ff5f57]"
        }
        onClick={onClose}
      >
        <CloseGlyph />
      </TrafficLight>
      <TrafficLight
        label="Minimize"
        className={
          focused
            ? "bg-[#febc2e] text-[#7a4600]"
            : "bg-[var(--traffic-idle)] text-[#7a4600] group-hover/traffic:bg-[#febc2e]"
        }
        onClick={onMinimize}
      >
        <MinimizeGlyph />
      </TrafficLight>
      <TrafficLight
        label={maximized ? "Restore" : "Maximize"}
        className={
          focused
            ? "bg-[#28c840] text-[#07500f]"
            : "bg-[var(--traffic-idle)] text-[#07500f] group-hover/traffic:bg-[#28c840]"
        }
        onClick={onMaximize}
      >
        <ZoomGlyph restore={maximized} />
      </TrafficLight>
    </div>
  );
}

function TrafficLight({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`sui-traffic-light flex size-[14px] items-center justify-center rounded-full outline-none ${className}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span className="flex opacity-0 transition-opacity duration-75 group-hover/traffic:opacity-100 group-focus-within/traffic:opacity-100">
        {children}
      </span>
    </button>
  );
}

// Glyphs are sized like macOS: roughly half the 14px light, drawn in a dark
// tint of the light's own colour (set via text-* on the button).
function CloseGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-[8px]">
      <path
        d="M2.2 2.2l7.6 7.6M9.8 2.2l-7.6 7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MinimizeGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-[9px]">
      <path
        d="M1.5 6h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** macOS zoom glyph: two triangles at top-left and bottom-right (inward when restoring). */
function ZoomGlyph({ restore }: { restore: boolean }) {
  if (restore) {
    return (
      <svg viewBox="0 0 12 12" aria-hidden className="size-[8px]">
        <path fill="currentColor" d="M5.6 5.6H1.2l4.4-4.4Z" />
        <path fill="currentColor" d="M6.4 6.4h4.4l-4.4 4.4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-[8px]">
      <path fill="currentColor" d="M1.4 1.4h4.8L1.4 6.2Z" />
      <path fill="currentColor" d="M10.6 10.6H5.8l4.8-4.8Z" />
    </svg>
  );
}

import type { AppId } from "@/src/data/apps";
import { getDockIconRect } from "@/src/lib/dock-geometry";
import { captureWindowBitmap, waitForDockSettle } from "@/src/lib/genie/capture";
import {
  easeMinimizeClock,
  easeRestoreClock,
  genieDurationMs,
  genieRestoreDurationMs,
  rectFromDom,
  type GenieRect,
} from "@/src/lib/genie/math";
import {
  createGenieRenderer,
  createStripRenderer,
  type GenieRenderer,
} from "@/src/lib/genie/renderer";

type Direction = "minimize" | "restore";

type Job = {
  abort: AbortController;
  raf: number;
  renderer: GenieRenderer | null;
  el: HTMLElement;
  direction: Direction;
};

type Snap = {
  canvas: HTMLCanvasElement;
  rect: GenieRect;
};

const jobs = new Map<string, Job>();
const snapshots = new Map<string, Snap>();

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hideWindow(el: HTMLElement) {
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.opacity = "0";
  el.style.transform = "none";
  el.style.clipPath = "none";
}

function showWindow(el: HTMLElement) {
  el.style.visibility = "visible";
  el.style.pointerEvents = "";
  el.style.opacity = "1";
  el.style.transform = "none";
  el.style.clipPath = "none";
}

export function cancelGenie(id: string) {
  const job = jobs.get(id);
  if (job) {
    job.abort.abort();
    if (job.raf) cancelAnimationFrame(job.raf);
    job.renderer?.destroy();
    if (job.direction === "restore") showWindow(job.el);
    else hideWindow(job.el);
    jobs.delete(id);
  }
  document.querySelectorAll(`[data-genie-id="${id}"]`).forEach((node) => node.remove());
}

function captureIcon(app: AppId): GenieRect | null {
  const rect = getDockIconRect(app);
  if (!rect || rect.width < 2 || rect.height < 2) return null;
  return rectFromDom(rect);
}

function pingDock(app: AppId, delayMs: number) {
  if (typeof window === "undefined") return;
  window.setTimeout(
    () => {
      window.dispatchEvent(new CustomEvent("serverui:dock-genie", { detail: { app } }));
    },
    Math.max(0, delayMs),
  );
}

function measureWindow(el: HTMLElement): GenieRect {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: Math.max(el.offsetWidth, 1),
    height: Math.max(el.offsetHeight, 1),
  };
}

function rectsMatch(a: GenieRect, b: GenieRect) {
  return Math.abs(a.width - b.width) < 1.5 && Math.abs(a.height - b.height) < 1.5;
}

async function snapshot(id: string, el: HTMLElement, live: GenieRect) {
  const canvas = await captureWindowBitmap(el, live);
  const snap: Snap = { canvas, rect: { ...live } };
  snapshots.set(id, snap);
  return snap;
}

function usableSnap(id: string, live: GenieRect) {
  const snap = snapshots.get(id);
  if (!snap) return null;
  if (!rectsMatch(snap.rect, live)) return null;
  return snap;
}

function playFrames(opts: {
  id: string;
  src: GenieRect;
  dst: GenieRect;
  from: number;
  to: number;
  duration: number;
  renderer: GenieRenderer;
  signal: AbortSignal;
  field: "minimize" | "restore";
}) {
  const { id, src, dst, from, to, duration, renderer, signal, field } = opts;
  return new Promise<void>((resolve) => {
    const started = performance.now();
    const job = jobs.get(id);
    if (!job) {
      resolve();
      return;
    }

    const tick = (now: number) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const u = Math.min(1, (now - started) / duration);
      const eased = from < to ? easeMinimizeClock(u) : easeRestoreClock(u);
      const t = from + (to - from) * eased;
      renderer.draw(t, src, dst, field);
      if (u >= 1) {
        renderer.draw(to, src, dst, field);
        resolve();
        return;
      }
      job.raf = requestAnimationFrame(tick);
    };
    job.raf = requestAnimationFrame(tick);
  });
}

export async function playGenie(opts: {
  id: string;
  el: HTMLElement;
  app: AppId;
  direction: Direction;
}) {
  const { id, el, app, direction } = opts;
  cancelGenie(id);

  if (reducedMotion()) {
    if (direction === "minimize") hideWindow(el);
    else showWindow(el);
    return;
  }

  const abort = new AbortController();
  const job: Job = { abort, raf: 0, renderer: null, el, direction };
  jobs.set(id, job);

  try {
    el.style.transform = "none";
    el.style.clipPath = "none";
    if (direction === "restore") {
      hideWindow(el);
    } else {
      el.style.visibility = "visible";
      el.style.opacity = "1";
      el.style.pointerEvents = "none";
    }

    if (direction === "restore") {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    } else {
      await waitForDockSettle();
    }
    if (abort.signal.aborted) return;

    const live = measureWindow(el);
    const icon = captureIcon(app) ?? {
      x: live.x + live.width / 2 - 22,
      y: window.innerHeight - 64,
      width: 44,
      height: 44,
    };

    const cached = direction === "restore" ? usableSnap(id, live) : null;
    let snap = cached;
    if (!snap) {
      if (direction === "restore") showWindow(el);
      snap = await snapshot(id, el, live);
      hideWindow(el);
    }
    if (abort.signal.aborted) return;

    const srcWindow = {
      x: live.x,
      y: live.y,
      width: snap.rect.width,
      height: snap.rect.height,
    };

    const renderer = createGenieRenderer(snap.canvas, id) ?? createStripRenderer(snap.canvas, id);
    if (!renderer) {
      if (direction === "restore") showWindow(el);
      return;
    }
    job.renderer = renderer;
    renderer.draw(direction === "minimize" ? 0 : 1, srcWindow, icon, direction);

    const duration =
      direction === "restore"
        ? genieRestoreDurationMs(srcWindow.width, srcWindow.height)
        : genieDurationMs(srcWindow.width, srcWindow.height);
    pingDock(app, direction === "minimize" ? duration * 0.78 : 16);

    await playFrames({
      id,
      src: srcWindow,
      dst: icon,
      from: direction === "minimize" ? 0 : 1,
      to: direction === "minimize" ? 1 : 0,
      duration,
      renderer,
      signal: abort.signal,
      field: direction,
    });

    if (abort.signal.aborted) return;
    if (direction === "restore") {
      renderer.draw(0, srcWindow, icon, "restore");
      showWindow(el);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    } else {
      hideWindow(el);
    }
  } catch {
    if (!abort.signal.aborted && direction === "restore") showWindow(el);
    if (!abort.signal.aborted && direction === "minimize") hideWindow(el);
  } finally {
    job.renderer?.destroy();
    job.renderer = null;
    if (jobs.get(id) === job) jobs.delete(id);
  }
}

export function animateWindowToDock(el: HTMLElement, app: AppId, id: string) {
  return playGenie({ id, el, app, direction: "minimize" });
}

export function animateWindowFromDock(el: HTMLElement, app: AppId, id: string) {
  return playGenie({ id, el, app, direction: "restore" });
}

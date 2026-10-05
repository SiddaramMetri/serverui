export const DOCK_ICON_SIZE = 48;
export const DOCK_ICON_COMPACT = 38;
export const DOCK_GAP = 16;
export const DOCK_GAP_COMPACT = 10;
export const DOCK_PAD_X = 20;
export const DOCK_PAD_Y = 14;
export const DOCK_MAG_RANGE = 108;
export const DOCK_MAG_MAX = 1.55;

export function dockIconSize(compact: boolean) {
  return compact ? DOCK_ICON_COMPACT : DOCK_ICON_SIZE;
}

export function scaleForDistance(
  distance: number,
  options: { compact: boolean; reducedMotion: boolean; maxScale?: number; range?: number },
) {
  if (options.reducedMotion || options.compact) return 1;
  const range = options.range ?? DOCK_MAG_RANGE;
  const maxScale = options.maxScale ?? DOCK_MAG_MAX;
  const t = Math.max(0, 1 - Math.abs(distance) / range);
  const smooth = t * t * (3 - 2 * t);
  return 1 + (maxScale - 1) * smooth;
}

export function dockLayout(
  scales: number[],
  iconSize: number,
  gap: number,
): { centers: number[]; total: number; lifts: number[] } {
  const centers: number[] = [];
  const lifts: number[] = [];
  let x = 0;
  for (const scale of scales) {
    const width = iconSize * scale;
    centers.push(x + width / 2);
    lifts.push((scale - 1) * iconSize * 0.42);
    x += width + gap;
  }
  return { centers, lifts, total: Math.max(0, x - gap) };
}

export function slotOrigin(index: number, count: number, iconSize: number, gap: number) {
  const base = count * iconSize + Math.max(0, count - 1) * gap;
  const start = -base / 2;
  return start + index * (iconSize + gap) + iconSize / 2;
}

/** Horizontal shift so a scaled icon stays inside the magnified tray. */
export function dockIconShift(center: number, total: number, origin: number) {
  return center - total / 2 - origin;
}

/** Horizontal slop so overflowed scaled icons still count as over the tray. */
export function dockOverflowSlop(iconSize: number) {
  return (DOCK_MAG_MAX - 1) * iconSize + DOCK_GAP;
}

/** Vertical slop for lifted/scaled icons, not empty space above the tray. */
export function dockLiftSlop(iconSize: number) {
  return (DOCK_MAG_MAX - 1) * iconSize;
}

export function dockHitTest(
  x: number,
  y: number,
  rect: { left: number; right: number; top: number; bottom: number },
  slopX: number,
  slopTop = dockLiftSlop(DOCK_ICON_SIZE),
  slopBottom = 16,
) {
  return (
    x >= rect.left - slopX &&
    x <= rect.right + slopX &&
    y >= rect.top - slopTop &&
    y <= rect.bottom + slopBottom
  );
}

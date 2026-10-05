import { describe, expect, it } from "vitest";
import { formatDockBadge } from "@/src/lib/dock-activity";
import {
  dockHitTest,
  dockIconShift,
  dockLayout,
  dockLiftSlop,
  dockOverflowSlop,
  scaleForDistance,
  slotOrigin,
} from "@/src/lib/dock-magnify";

describe("dock magnification", () => {
  it("peaks at the cursor and falls off with distance", () => {
    const hover = scaleForDistance(0, { compact: false, reducedMotion: false });
    const near = scaleForDistance(48, { compact: false, reducedMotion: false });
    const far = scaleForDistance(140, { compact: false, reducedMotion: false });
    expect(hover).toBeGreaterThan(1.45);
    expect(near).toBeGreaterThan(1.1);
    expect(near).toBeLessThan(hover);
    expect(far).toBe(1);
  });

  it("disables magnification for compact and reduced-motion modes", () => {
    expect(scaleForDistance(0, { compact: true, reducedMotion: false })).toBe(1);
    expect(scaleForDistance(0, { compact: false, reducedMotion: true })).toBe(1);
  });

  it("lays out scaled icons without overlapping centers", () => {
    const { centers, total } = dockLayout([1, 1.5, 1], 52, 8);
    expect(centers).toHaveLength(3);
    expect(centers[1]).toBeGreaterThan(centers[0]!);
    expect(centers[2]).toBeGreaterThan(centers[1]!);
    expect(total).toBeGreaterThan(52 * 3);
  });

  it("keeps magnified icon edges inside the expanded tray", () => {
    const iconSize = 48;
    const gap = 10;
    const scales = [1.55, 1.28, 1.08, 1, 1];
    const layout = dockLayout(scales, iconSize, gap);
    const count = scales.length;
    const extra = (layout.total - (count * iconSize + (count - 1) * gap)) / 2;
    for (let i = 0; i < count; i += 1) {
      const origin = slotOrigin(i, count, iconSize, gap);
      const dx = dockIconShift(layout.centers[i]!, layout.total, origin);
      const visualLeft = -iconSize / 2 + dx - ((scales[i]! - 1) * iconSize) / 2;
      const visualRight = iconSize / 2 + dx + ((scales[i]! - 1) * iconSize) / 2;
      const trayLeft = -layout.total / 2;
      const trayRight = layout.total / 2;
      expect(visualLeft).toBeGreaterThanOrEqual(trayLeft - 0.01);
      expect(visualRight).toBeLessThanOrEqual(trayRight + 0.01);
      expect(extra).toBeGreaterThan(0);
    }
  });

  it("treats overflowed scaled icons as still over the tray", () => {
    const slopX = dockOverflowSlop(48);
    const slopTop = dockLiftSlop(48);
    const rect = { left: 200, right: 600, top: 500, bottom: 580 };
    expect(dockHitTest(191, 540, rect, 8, slopTop)).toBe(false);
    expect(dockHitTest(191, 540, rect, slopX, slopTop)).toBe(true);
    expect(dockHitTest(400, 480, rect, slopX, slopTop)).toBe(true);
    expect(dockHitTest(400, 420, rect, slopX, slopTop)).toBe(false);
  });
});

describe("dock badges", () => {
  it("formats compact counts", () => {
    expect(formatDockBadge(0)).toBe("");
    expect(formatDockBadge(3)).toBe("3");
    expect(formatDockBadge(12)).toBe("9+");
    expect(formatDockBadge(120)).toBe("99+");
  });
});

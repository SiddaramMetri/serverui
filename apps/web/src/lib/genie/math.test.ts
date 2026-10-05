import { describe, expect, it } from "vitest";
import {
  deformVertex,
  easeMinimizeClock,
  easeRestoreClock,
  fillPositionGrid,
  genieDurationMs,
  genieRestoreDurationMs,
  rowLead,
  type GenieRect,
} from "./math";

const src: GenieRect = { x: 100, y: 80, width: 400, height: 300 };
const dst: GenieRect = { x: 620, y: 740, width: 48, height: 48 };

describe("genie math", () => {
  it("maps every vertex to the source rectangle at t = 0", () => {
    const topLeft = deformVertex(0, 0, 0, src, dst);
    const bottomRight = deformVertex(1, 1, 0, src, dst);
    expect(topLeft.x).toBeCloseTo(src.x, 5);
    expect(topLeft.y).toBeCloseTo(src.y, 5);
    expect(bottomRight.x).toBeCloseTo(src.x + src.width, 5);
    expect(bottomRight.y).toBeCloseTo(src.y + src.height, 5);
  });

  it("maps every vertex onto the dock icon rectangle at t = 1", () => {
    const topLeft = deformVertex(0, 0, 1, src, dst);
    const mid = deformVertex(0.5, 0.5, 1, src, dst);
    const bottomRight = deformVertex(1, 1, 1, src, dst);
    expect(topLeft.x).toBeCloseTo(dst.x, 4);
    expect(topLeft.y).toBeCloseTo(dst.y, 4);
    expect(mid.x).toBeCloseTo(dst.x + dst.width / 2, 4);
    expect(mid.y).toBeCloseTo(dst.y + dst.height / 2, 4);
    expect(bottomRight.x).toBeCloseTo(dst.x + dst.width, 4);
    expect(bottomRight.y).toBeCloseTo(dst.y + dst.height, 4);
  });

  it("fully pinches the bottom edge to the dock width early", () => {
    const left = deformVertex(0, 1, 0.2, src, dst);
    const right = deformVertex(1, 1, 0.2, src, dst);
    expect(right.x - left.x).toBeCloseTo(dst.width, 1);
    const topLeft = deformVertex(0, 0, 0.2, src, dst);
    const topRight = deformVertex(1, 0, 0.2, src, dst);
    expect(topRight.x - topLeft.x).toBeGreaterThan(src.width * 0.55);
  });

  it("restores with a pinched genie tail that then eases open", () => {
    const widthAt = (t: number, v: number) =>
      deformVertex(1, v, t, src, dst, "restore").x - deformVertex(0, v, t, src, dst, "restore").x;

    expect(widthAt(0.52, 1)).toBeCloseTo(dst.width, 0);
    expect(widthAt(0.52, 0)).toBeGreaterThan(src.width * 0.4);
    expect(widthAt(0.52, 0)).toBeLessThan(src.width * 0.62);
    expect(widthAt(0.22, 1)).toBeGreaterThan(dst.width * 1.3);
    expect(widthAt(0.22, 1)).toBeLessThan(src.width * 0.7);
    expect(widthAt(0, 1)).toBeCloseTo(src.width, 4);
    expect(widthAt(0, 0)).toBeCloseTo(src.width, 4);
  });

  it("collapses the dock-adjacent edge earlier than the far edge", () => {
    const t = 0.28;
    const top = deformVertex(0, 0, t, src, dst);
    const bottom = deformVertex(0, 1, t, src, dst);
    const topTravel = Math.hypot(top.x - src.x, top.y - src.y);
    const bottomTravel = Math.hypot(bottom.x - src.x, bottom.y - (src.y + src.height));
    expect(bottomTravel).toBeGreaterThan(topTravel);
    expect(rowLead(t, 1)).toBeGreaterThan(rowLead(t, 0));
  });

  it("curves toward a side icon rather than the window center", () => {
    const leftIcon: GenieRect = { x: 40, y: 740, width: 40, height: 40 };
    const mid = deformVertex(0.5, 0.7, 0.55, src, leftIcon);
    const srcCx = src.x + src.width / 2;
    expect(mid.x).toBeLessThan(srcCx);
  });

  it("minimizes slow-to-fast and restores come-out then expand", () => {
    expect(easeMinimizeClock(0.5)).toBeLessThan(0.5);
    expect(easeMinimizeClock(0.9) - easeMinimizeClock(0.8)).toBeGreaterThan(
      easeMinimizeClock(0.2) - easeMinimizeClock(0.1),
    );
    expect(easeRestoreClock(0.48)).toBeLessThan(0.5);
    expect(easeRestoreClock(1) - easeRestoreClock(0.48)).toBeGreaterThan(0.45);
    expect(easeMinimizeClock(0)).toBe(0);
    expect(easeMinimizeClock(1)).toBe(1);
    expect(easeRestoreClock(0)).toBe(0);
    expect(easeRestoreClock(1)).toBe(1);
  });

  it("scales duration with window size inside 220–320ms", () => {
    expect(genieDurationMs(240, 180)).toBeGreaterThanOrEqual(220);
    expect(genieDurationMs(1600, 1000)).toBeLessThanOrEqual(340);
    expect(genieDurationMs(1600, 1000)).toBeGreaterThan(genieDurationMs(240, 180));
  });

  it("gives restore time to come out then expand", () => {
    expect(genieRestoreDurationMs(800, 600)).toBeGreaterThan(genieDurationMs(800, 600));
  });

  it("writes a clip-space grid without querying live geometry", () => {
    const cols = 24;
    const rows = 28;
    const out = fillPositionGrid(
      new Float32Array((cols + 1) * (rows + 1) * 2),
      0,
      src,
      dst,
      1000,
      800,
    );
    expect(out[0]).toBeCloseTo((src.x / 1000) * 2 - 1, 5);
    expect(out[1]).toBeCloseTo(1 - (src.y / 800) * 2, 5);
  });
});

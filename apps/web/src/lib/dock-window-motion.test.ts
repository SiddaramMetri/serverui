import { describe, expect, it } from "vitest";
import { deformVertex, type GenieRect } from "./genie/math";

const src: GenieRect = { x: 40, y: 60, width: 500, height: 320 };
const icon: GenieRect = { x: 390, y: 760, width: 52, height: 52 };

describe("genie restore is the inverse of minimize", () => {
  it("uses the same window-to-icon field so t=0 is the window", () => {
    const origin = deformVertex(0.25, 0.8, 0, src, icon, "restore");
    expect(origin.x).toBeCloseTo(src.x + 0.25 * src.width, 4);
    expect(origin.y).toBeCloseTo(src.y + 0.8 * src.height, 4);
  });
});

import { describe, expect, it } from "vitest";
import {
  downsampleAvg,
  indexAt,
  lerpSeries,
  pickPoints,
  resample,
  seriesCoords,
  smoothLine,
} from "./chart-path";

describe("chart-path", () => {
  it("buckets noisy samples into a shorter series", () => {
    const values = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 80 : 10));
    const sampled = downsampleAvg(values, 10);
    expect(sampled).toHaveLength(10);
    expect(sampled.every((value) => value > 30 && value < 60)).toBe(true);
  });

  it("lerps equal-length series", () => {
    expect(lerpSeries([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });

  it("builds a curved path instead of a polyline", () => {
    const coords = seriesCoords([10, 40, 20, 70], 100, 40, 100);
    const d = smoothLine(coords);
    expect(d.startsWith("M")).toBe(true);
    expect(d.includes(" C")).toBe(true);
    expect(d.includes(" L")).toBe(false);
  });

  it("picks evenly spaced samples", () => {
    const points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(pickPoints(points, 5)).toHaveLength(5);
  });

  it("maps a hover x to the nearest sample", () => {
    expect(indexAt(0, 100, 5)).toBe(0);
    expect(indexAt(100, 100, 5)).toBe(4);
    expect(indexAt(50, 100, 5)).toBe(2);
  });

  it("resamples to a fixed length", () => {
    expect(resample([0, 10], 5)).toHaveLength(5);
    expect(resample([0, 10], 5)[0]).toBe(0);
    expect(resample([0, 10], 5)[4]).toBe(10);
  });
});

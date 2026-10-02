export type XY = { x: number; y: number };

export function downsampleAvg(values: number[], count: number): number[] {
  if (values.length === 0) return [];
  if (values.length <= count) return values.slice();
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i / count) * values.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * values.length));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += values[j];
    out.push(sum / (end - start));
  }
  return out;
}

export function lerpSeries(from: number[], to: number[], t: number): number[] {
  const n = to.length;
  const src = resample(from, n);
  return to.map((value, index) => src[index] + (value - src[index]) * t);
}

export function resample(values: number[], count: number): number[] {
  if (count <= 0) return [];
  if (values.length === 0) return Array.from({ length: count }, () => 0);
  if (values.length === 1) return Array.from({ length: count }, () => values[0]);
  if (values.length === count) return values.slice();
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const pos = (i / (count - 1)) * (values.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(values.length - 1, lo + 1);
    const frac = pos - lo;
    out.push(values[lo] * (1 - frac) + values[hi] * frac);
  }
  return out;
}

export function seriesCoords(
  values: number[],
  width: number,
  height: number,
  max: number,
  padY = 3,
): XY[] {
  const cap = Math.max(max, 1);
  const inner = Math.max(1, height - padY * 2);
  return values.map((value, index) => ({
    x: values.length === 1 ? 0 : (index / Math.max(1, values.length - 1)) * width,
    y: padY + inner - (clamp(value, 0, cap) / cap) * inner,
  }));
}

export function smoothLine(coords: XY[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M${fmt(coords[0].x)} ${fmt(coords[0].y)}`;
  if (coords.length === 2) {
    return `M${fmt(coords[0].x)} ${fmt(coords[0].y)} L${fmt(coords[1].x)} ${fmt(coords[1].y)}`;
  }
  let d = `M${fmt(coords[0].x)} ${fmt(coords[0].y)}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

export function smoothArea(coords: XY[], width: number, height: number): string {
  const line = smoothLine(coords);
  if (!line) return "";
  return `${line} L${fmt(width)} ${fmt(height)} L0 ${fmt(height)} Z`;
}

export function smoothRibbon(top: XY[], bottom: XY[]): string {
  if (top.length === 0 || bottom.length === 0) return "";
  const topPath = smoothLine(top);
  const bottomPath = smoothLine([...bottom].reverse());
  if (!topPath || !bottomPath) return "";
  return `${topPath} ${bottomPath.replace(/^M/, "L")} Z`;
}

export function pickPoints<T>(points: T[], count: number): T[] {
  if (points.length <= count) return points.slice();
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i / count) * points.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * points.length));
    out.push(points[Math.min(points.length - 1, start + Math.floor((end - start) / 2))]);
  }
  return out;
}

export function indexAt(x: number, width: number, count: number) {
  if (count <= 1 || width <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round((x / width) * (count - 1))));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fmt(value: number) {
  return value.toFixed(2);
}

export type GenieRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const GENIE_COLS = 24;
export const GENIE_ROWS = 28;

export function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInQuad(t: number) {
  const x = clamp01(t);
  return x * x;
}

export function easeOutQuad(t: number) {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

/** Clock easing: minimize is slow then snaps into the dock. */
export function easeMinimizeClock(p: number) {
  return easeInQuad(p);
}

/** First half: come out of the dock still genie-shaped. Second half: expand to the window. */
export function easeRestoreClock(p: number) {
  const x = clamp01(p);
  const emergeEnd = 0.48;
  const emergeProgress = 0.46;
  if (x <= emergeEnd) {
    return emergeProgress * easeOutQuad(x / emergeEnd);
  }
  const u = (x - emergeEnd) / (1 - emergeEnd);
  return emergeProgress + (1 - emergeProgress) * easeOutCubic(u);
}

/** Spatial field uses raw t; timing is applied on the animation clock. */
export function easeGenie(t: number) {
  return clamp01(t);
}

export function rowLead(t: number, v: number) {
  const delay = (1 - clamp01(v)) * 0.5;
  const span = Math.max(0.001, 1 - delay);
  return easeGenie(clamp01((t - delay) / span));
}

export function genieDurationMs(width: number, height: number) {
  const diag = Math.hypot(Math.max(width, 1), Math.max(height, 1));
  return Math.round(220 + Math.min(100, diag / 18));
}

export function genieRestoreDurationMs(width: number, height: number) {
  return Math.round(genieDurationMs(width, height) * 1.16);
}

export function rectFromDom(rect: DOMRect | GenieRect): GenieRect {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  };
}

export type GenieField = "minimize" | "restore";

function holdThenEase(t: number, holdUntil: number) {
  if (t >= holdUntil) return 1;
  return easeOutCubic(t / Math.max(holdUntil, 0.001));
}

function tailBlend(v: number) {
  const x = clamp01((clamp01(v) - 0.22) / 0.78);
  return Math.pow(x * x * (3 - 2 * x), 1.2);
}

/**
 * `src` is always the live window. `dst` is always the dock icon.
 * `t = 0` is the full window; `t = 1` is fully in the icon.
 * Minimize pinches the dock-adjacent edge early. Restore keeps a genie tail
 * (bottom pinched to the icon) then eases that tail open to the window.
 */
export function deformVertex(
  u: number,
  v: number,
  t: number,
  src: GenieRect,
  dst: GenieRect,
  field: GenieField = "minimize",
) {
  const tt = clamp01(t);
  const vv = clamp01(v);
  const srcCx = src.x + src.width * 0.5;
  const dstCx = dst.x + dst.width * 0.5;
  const destScaleX = dst.width / src.width;
  const srcY = src.y + vv * src.height;
  const dstY = dst.y + vv * dst.height;

  if (field === "restore") {
    const funnel = tailBlend(vv);
    const bodyT = tt;
    const tailT = holdThenEase(tt, 0.48);
    const pinch = lerp(bodyT, tailT, funnel);
    const yPull = lerp(tt, holdThenEase(tt, 0.48), Math.pow(vv, 1.12));
    const scaleX = lerp(1, destScaleX, pinch);
    const cx = lerp(srcCx, dstCx, pinch);
    return {
      x: cx + (u - 0.5) * src.width * scaleX,
      y: lerp(srcY, dstY, yPull),
    };
  }

  const neck = easeOutCubic(clamp01(tt / 0.14));
  const funnel = Math.pow(vv, 1.35);
  const body = easeGenie(tt);
  const pinch = clamp01(neck * funnel + body * (1 - funnel));
  const scaleX = lerp(1, destScaleX, pinch);
  const cx = lerp(srcCx, dstCx, pinch);
  const yPull = clamp01(neck * Math.pow(vv, 0.75) + body * (1 - Math.pow(vv, 0.75)));
  return {
    x: cx + (u - 0.5) * src.width * scaleX,
    y: lerp(srcY, dstY, yPull),
  };
}

export function fillPositionGrid(
  out: Float32Array,
  t: number,
  src: GenieRect,
  dst: GenieRect,
  viewW: number,
  viewH: number,
  cols = GENIE_COLS,
  rows = GENIE_ROWS,
  field: GenieField = "minimize",
) {
  let i = 0;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols;
      const p = deformVertex(u, v, t, src, dst, field);
      out[i] = (p.x / viewW) * 2 - 1;
      out[i + 1] = 1 - (p.y / viewH) * 2;
      i += 2;
    }
  }
  return out;
}

export function meshIndexCount(cols = GENIE_COLS, rows = GENIE_ROWS) {
  return cols * rows * 6;
}

export function buildMeshIndices(cols = GENIE_COLS, rows = GENIE_ROWS) {
  const indices = new Uint16Array(meshIndexCount(cols, rows));
  const stride = cols + 1;
  let i = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }
  return indices;
}

export function buildMeshUvs(cols = GENIE_COLS, rows = GENIE_ROWS) {
  const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
  let i = 0;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols;
      uvs[i++] = u;
      uvs[i++] = v;
    }
  }
  return uvs;
}

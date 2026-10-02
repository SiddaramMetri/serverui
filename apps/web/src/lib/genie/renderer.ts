import {
  buildMeshIndices,
  buildMeshUvs,
  deformVertex,
  fillPositionGrid,
  GENIE_COLS,
  GENIE_ROWS,
  type GenieField,
  type GenieRect,
} from "@/src/lib/genie/math";

const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform vec4 u_tint;
void main() {
  vec4 color = texture2D(u_tex, v_uv);
  gl_FragColor = vec4(mix(color.rgb, u_tint.rgb, u_tint.a), color.a * u_alpha);
}
`;

export type GenieRenderer = {
  canvas: HTMLCanvasElement;
  draw: (t: number, src: GenieRect, dst: GenieRect, field?: GenieField) => void;
  resize: () => void;
  destroy: () => void;
};

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "compile");
  }
  return shader;
}

export function createGenieRenderer(bitmap: HTMLCanvasElement, id = ""): GenieRenderer | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-genie-overlay", "true");
  if (id) canvas.setAttribute("data-genie-id", id);
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;";
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    canvas.remove();
    return null;
  }

  let program: WebGLProgram;
  try {
    const created = gl.createProgram();
    if (!created) throw new Error("program");
    program = created;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("link");
  } catch {
    canvas.remove();
    return null;
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const pos = new Float32Array((GENIE_COLS + 1) * (GENIE_ROWS + 1) * 2);
  const posBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, buildMeshUvs(), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buildMeshIndices(), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos.byteLength, gl.DYNAMIC_DRAW);

  const aPos = gl.getAttribLocation(program, "a_pos");
  const aUv = gl.getAttribLocation(program, "a_uv");
  const uAlpha = gl.getUniformLocation(program, "u_alpha");
  const uTint = gl.getUniformLocation(program, "u_tint");
  const uTex = gl.getUniformLocation(program, "u_tex");

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.uniform1i(uTex, 0);

  const indexCount = GENIE_COLS * GENIE_ROWS * 6;

  function bindAttribs() {
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(t: number, src: GenieRect, dst: GenieRect, field: GenieField = "minimize") {
    resize();
    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindAttribs();
    fillPositionGrid(pos, t, src, dst, viewW, viewH, GENIE_COLS, GENIE_ROWS, field);
    if (t < 0.97) {
      const drop = ((10 * (1 - t)) / viewH) * 2;
      for (let i = 1; i < pos.length; i += 2) pos[i] -= drop;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.uniform1f(uAlpha, 0.32 * (1 - Math.pow(t, 2.4)));
      gl.uniform4f(uTint, 0.02, 0.02, 0.04, 0.82);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      fillPositionGrid(pos, t, src, dst, viewW, viewH, GENIE_COLS, GENIE_ROWS, field);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.uniform1f(uAlpha, 1);
    gl.uniform4f(uTint, 0, 0, 0, 0);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  }

  function destroy() {
    canvas.remove();
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(uvBuf);
    gl.deleteBuffer(idxBuf);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  }

  resize();
  return { canvas, draw, resize, destroy };
}

const STRIP_ROWS = 32;

export function createStripRenderer(bitmap: HTMLCanvasElement, id = ""): GenieRenderer {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-genie-overlay", "true");
  if (id) canvas.setAttribute("data-genie-id", id);
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  return {
    canvas,
    resize,
    destroy() {
      canvas.remove();
    },
    draw(t: number, src: GenieRect, dst: GenieRect, field: GenieField = "minimize") {
      if (!ctx) return;
      resize();
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const dpr = canvas.width / Math.max(cssW, 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.imageSmoothingEnabled = true;
      if (t < 0.97) {
        ctx.globalAlpha = 0.32 * (1 - Math.pow(t, 2.4));
        ctx.fillStyle = "rgba(8,8,12,0.85)";
        paintStrips(ctx, bitmap, t, src, dst, true, field);
      }
      ctx.globalAlpha = 1;
      paintStrips(ctx, bitmap, t, src, dst, false, field);
      ctx.globalAlpha = 1;
    },
  };
}

function paintStrips(
  ctx: CanvasRenderingContext2D,
  bitmap: HTMLCanvasElement,
  t: number,
  src: GenieRect,
  dst: GenieRect,
  shadow: boolean,
  field: GenieField = "minimize",
) {
  const sw = bitmap.width;
  const sh = bitmap.height;
  for (let i = 0; i < STRIP_ROWS; i += 1) {
    const v0 = i / STRIP_ROWS;
    const v1 = (i + 1) / STRIP_ROWS;
    const l0 = deformVertex(0, v0, t, src, dst, field);
    const r0 = deformVertex(1, v0, t, src, dst, field);
    const l1 = deformVertex(0, v1, t, src, dst, field);
    const r1 = deformVertex(1, v1, t, src, dst, field);
    const sy = v0 * sh;
    const sHeight = Math.max(1, (v1 - v0) * sh);
    const dx = (l0.x + l1.x) / 2 + (shadow ? 6 * (1 - t) : 0);
    const dy = (l0.y + r0.y) / 2 + (shadow ? 10 * (1 - t) : 0);
    const dw = Math.max(1, (r0.x - l0.x + (r1.x - l1.x)) / 2);
    const dh = Math.max(0.6, (l1.y + r1.y) / 2 - (l0.y + r0.y) / 2);
    if (shadow) ctx.fillRect(dx, dy, dw, dh);
    else ctx.drawImage(bitmap, 0, sy, sw, sHeight, dx, dy, dw, dh);
  }
}

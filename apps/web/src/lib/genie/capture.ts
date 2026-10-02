function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function waitForDockSettle() {
  await nextPaint();
}

function stylesheetCss() {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      chunks.push(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n"),
      );
    } catch {
      if (sheet instanceof CSSStyleSheet && sheet.href) {
        chunks.push(`@import url("${sheet.href}");`);
      }
    }
  }
  return chunks.join("\n");
}

function paintFallback(el: HTMLElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  const style = getComputedStyle(el);
  const radius = el.classList.contains("rounded-none") ? 0 : 12;
  ctx.fillStyle = style.backgroundColor || "rgba(28, 28, 30, 0.92)";
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, width, 36);
  ctx.strokeStyle = style.borderColor || "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, radius);
  ctx.stroke();
  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function captureViaSvg(el: HTMLElement, width: number, height: number) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.clipPath = "none";
  clone.style.opacity = "1";
  clone.style.visibility = "visible";
  clone.style.position = "static";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.pointerEvents = "none";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const foreign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  foreign.setAttribute("width", "100%");
  foreign.setAttribute("height", "100%");
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = "hidden";
  const style = document.createElement("style");
  style.textContent = stylesheetCss();
  wrapper.append(style, clone);
  foreign.appendChild(wrapper);
  svg.appendChild(foreign);

  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("genie snapshot failed"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return paintFallback(el, width, height);
    ctx.scale(dpr, dpr);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SNAPSHOT_STYLE = {
  transform: "none",
  clipPath: "none",
  opacity: "1",
  visibility: "visible",
  pointerEvents: "none",
  margin: "0",
};

function normalizeCanvas(source: HTMLCanvasElement, width: number, height: number) {
  if (source.width === width && source.height === height) return source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function captureWindowBitmap(
  el: HTMLElement,
  rect: { width: number; height: number },
) {
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  try {
    const { toCanvas } = await import("html-to-image");
    const raw = await toCanvas(el, {
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 1,
      cacheBust: false,
      style: {
        ...SNAPSHOT_STYLE,
        width: `${width}px`,
        height: `${height}px`,
      },
    });
    return normalizeCanvas(raw, width, height);
  } catch {
    try {
      const raw = await captureViaSvg(el, width, height);
      return normalizeCanvas(raw, width, height);
    } catch {
      return paintFallback(el, width, height);
    }
  }
}

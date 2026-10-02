"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  downsampleAvg,
  indexAt,
  lerpSeries,
  pickPoints,
  seriesCoords,
  smoothArea,
  smoothLine,
  smoothRibbon,
} from "@/src/components/apps/monitor/chart-path";
import {
  formatBytes,
  formatRate,
  type ChartKey,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";

type Series = {
  key: ChartKey;
  color: string;
};

const SPARK_BUCKETS = 32;
const CHART_BUCKETS = 64;
const SPARK_W = 240;
const SPARK_H = 48;

function seriesSignature(values: number[]) {
  if (values.length === 0) return "0";
  let sum = 0;
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return `${values.length}:${values[0]}:${values[values.length - 1]}:${min}:${max}:${sum.toFixed(2)}`;
}

function useDisplayValues(values: number[], buckets: number) {
  const signature = seriesSignature(values);
  const target = useMemo(() => downsampleAvg(values, buckets), [buckets, signature, values]);
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (target.length === 0) {
      return undefined;
    }
    const from = display;
    if (from.length === 0) {
      return undefined;
    }
    const start = performance.now();
    const duration = 560;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(lerpSeries(from, target, eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Animate when the downsampled series changes; `display` is the interpolation origin.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart from the visible series
  }, [target]);

  if (target.length === 0) return [];
  if (display.length === 0) return target;
  return display;
}

function SparkChart({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  max?: number;
  className?: string;
}) {
  const display = useDisplayValues(values, SPARK_BUCKETS);
  const id = useId().replace(/:/g, "");
  const peak = display.reduce((highest, value) => (value > highest ? value : highest), 0);
  const scale = Math.max(peak * 1.22, 1);
  const coords = seriesCoords(display, SPARK_W, SPARK_H, scale, 6);
  const line = smoothLine(coords);
  const area = smoothArea(coords, SPARK_W, SPARK_H);
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {line ? (
        <>
          <path d={area} fill={`url(#spark-${id})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : (
        <line
          x1="0"
          y1={SPARK_H - 4}
          x2={SPARK_W}
          y2={SPARK_H - 4}
          stroke={color}
          strokeOpacity="0.2"
        />
      )}
    </svg>
  );
}

export function Sparkline({
  points,
  series,
  color,
  max = 100,
  className,
}: {
  points: HistoryPoint[];
  series: ChartKey;
  color: string;
  max?: number;
  className?: string;
}) {
  const values = useMemo(() => points.map((point) => Number(point[series] || 0)), [points, series]);
  return <SparkChart values={values} color={color} max={max} className={className} />;
}

export function SparklineValues({
  values,
  color,
  max = 100,
  className,
}: {
  values: number[];
  color: string;
  max?: number;
  className?: string;
}) {
  return <SparkChart values={values} color={color} max={max} className={className} />;
}

export function AreaChart({
  points,
  series,
}: {
  points: HistoryPoint[];
  series: Series[];
  height?: number;
}) {
  const width = 1000;
  const plotH = 160;
  const padL = 44;
  const padY = 8;
  const innerW = width - padL;
  const innerH = plotH - padY * 2;
  const cpuMax = 100;
  const netMax = Math.max(1, ...points.map((p) => Math.max(p.netRx, p.netTx)));
  const ticks = [0, 25, 50, 75, 100];
  const drawn = useMemo(() => pickPoints(points, 120), [points]);
  const labels = tickLabels(points);
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);
  const active = hover ? drawn[hover.index] : null;

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || drawn.length === 0) return;
    const cssX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const vbX = (cssX / rect.width) * width;
    const innerX = Math.min(Math.max(0, vbX - padL), innerW);
    const index = indexAt(innerX, innerW, drawn.length);
    const x = padL + (drawn.length === 1 ? 0 : (index / Math.max(1, drawn.length - 1)) * innerW);
    setHover({ index, x });
  }

  function seriesY(key: ChartKey, value: number) {
    const max = key === "netRx" || key === "netTx" ? netMax : cpuMax;
    const capped = Math.max(0, Math.min(max, value));
    return padY + innerH - (capped / Math.max(max, 1)) * innerH;
  }

  return (
    <div className="grid h-full min-w-0 grid-rows-[minmax(0,1fr)_1.35rem]">
      <div className="relative min-h-0 min-w-0">
        <div
          ref={plotRef}
          className="absolute inset-0 cursor-crosshair overflow-hidden"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${plotH}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label="Resource usage"
          >
            {ticks.map((tick) => {
              const y = seriesY("cpu", tick);
              return (
                <line
                  key={tick}
                  x1={padL}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                />
              );
            })}
            {hover ? (
              <line
                x1={hover.x}
                x2={hover.x}
                y1={0}
                y2={plotH}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {series.map((item) => {
              const max = item.key === "netRx" || item.key === "netTx" ? netMax : cpuMax;
              const values = drawn.map((point) => Number(point[item.key] || 0));
              const coords = seriesCoords(values, innerW, plotH, max, padY).map((point) => ({
                x: point.x + padL,
                y: point.y,
              }));
              const d = smoothLine(coords);
              if (!d) return null;
              const knot = hover ? coords[hover.index] : null;
              return (
                <g key={item.key}>
                  <path
                    d={d}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {knot ? (
                    <circle
                      cx={knot.x}
                      cy={knot.y}
                      r="3.5"
                      fill={item.color}
                      stroke="#0b1018"
                      strokeWidth="1.25"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hover && active ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[148px] sui-glass-card rounded-xl px-2.5 py-2 text-[11px] shadow-lg"
              style={{
                left: `${(hover.x / width) * 100}%`,
                top: 8,
                transform:
                  hover.x / width > 0.58 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
              }}
            >
              <p className="mb-1.5 font-medium text-white/80">
                {new Date(active.t).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <ul className="space-y-1">
                {series.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-white/55">
                      <span className="size-1.5 rounded-full" style={{ background: item.color }} />
                      {seriesLabel(item.key)}
                    </span>
                    <span className="tabular-nums text-white/90">
                      {formatChartValue(item.key, active)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 flex w-10 flex-col justify-between py-px pr-1 text-right text-[10px] tabular-nums text-white/40">
          {[...ticks].reverse().map((tick) => (
            <span
              key={tick}
              className={
                tick === 0 ? "translate-y-[-2px]" : tick === 100 ? "translate-y-[2px]" : undefined
              }
            >
              {tick}%
            </span>
          ))}
        </div>
      </div>
      <div
        className="flex items-start justify-between pt-1 text-[10px] leading-none text-white/35"
        style={{ paddingLeft: `${(padL / width) * 100}%`, paddingRight: 4 }}
      >
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function seriesLabel(key: ChartKey) {
  switch (key) {
    case "cpu":
      return "CPU";
    case "cpuUser":
      return "User";
    case "cpuSystem":
      return "System";
    case "cpuIowait":
      return "I/O Wait";
    case "memory":
      return "Memory";
    case "disk":
      return "Disk";
    case "netRx":
      return "Network";
    case "netTx":
      return "Upload";
    default:
      return key;
  }
}

function formatChartValue(key: ChartKey, point: HistoryPoint) {
  if (key === "netRx" || key === "netTx" || key === "diskReadBps" || key === "diskWriteBps") {
    return formatRate(Number(point[key] || 0));
  }
  if (
    key === "memUsedBytes" ||
    key === "memCachedBytes" ||
    key === "memBuffersBytes" ||
    key === "memAvailableBytes"
  ) {
    return formatBytes(Number(point[key] || 0));
  }
  return `${Number(point[key] || 0).toFixed(1)}%`;
}

export function ProcessUsageChart({
  points,
  height = 180,
}: {
  points: HistoryPoint[];
  height?: number;
}) {
  const width = 720;
  const padY = 8;
  const innerH = height - padY * 2;
  const max = 100;
  const ticks = [0, 25, 50, 75, 100];
  const labels = tickLabels(points);
  const layers = [
    { key: "memory" as const, color: "#c084fc", opacity: 0.28 },
    { key: "cpu" as const, color: "#34d399", opacity: 0.35 },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Process resource usage"
    >
      {ticks.map((tick) => {
        const y = padY + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line x1="36" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x="0" y={y + 3} fill="rgba(255,255,255,0.35)" fontSize="10">
              {tick}%
            </text>
          </g>
        );
      })}
      {layers.map((layer) => {
        const values = points.map((point) => Number(point[layer.key] || 0));
        const d = areaFromValues(values, width - 36, innerH, max);
        if (!d) return null;
        return (
          <path
            key={layer.key}
            transform="translate(36, 8)"
            d={d}
            fill={layer.color}
            fillOpacity={layer.opacity}
            stroke={layer.color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        );
      })}
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={36 + (index / Math.max(1, labels.length - 1)) * (width - 36)}
          y={height - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export function ServiceStatusChart({
  points,
  height = 180,
}: {
  points: HistoryPoint[];
  height?: number;
}) {
  const width = 720;
  const padY = 8;
  const innerH = height - padY * 2;
  const peak = Math.max(
    1,
    ...points.map((point) =>
      Math.max(
        point.svcRunning || 0,
        point.svcStopped || 0,
        point.svcFailed || 0,
        point.svcOther || 0,
        (point.svcRunning || 0) + (point.svcStopped || 0),
      ),
    ),
  );
  const max = niceCountMax(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labels = tickLabels(points);
  const layers = [
    { key: "svcRunning" as const, color: "#34d399", opacity: 0.4 },
    { key: "svcOther" as const, color: "#94a3b8", opacity: 0.35 },
    { key: "svcFailed" as const, color: "#fbbf24", opacity: 0.55 },
    { key: "svcStopped" as const, color: "#fb7185", opacity: 0.5 },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Service status"
    >
      {ticks.map((tick) => {
        const y = padY + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1="36" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x="0" y={y + 3} fill="rgba(255,255,255,0.35)" fontSize="10">
              {Math.round(tick * max)}
            </text>
          </g>
        );
      })}
      {layers.map((layer) => {
        const values = points.map((point) => Number(point[layer.key] || 0));
        const d = areaFromValues(values, width - 36, innerH, max);
        if (!d) return null;
        return (
          <path
            key={layer.key}
            transform="translate(36, 8)"
            d={d}
            fill={layer.color}
            fillOpacity={layer.opacity}
            stroke={layer.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        );
      })}
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={36 + (index / Math.max(1, labels.length - 1)) * (width - 36)}
          y={height - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function tickLabels(points: HistoryPoint[]) {
  if (points.length === 0) return [];
  const count = Math.min(5, points.length);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i / Math.max(1, count - 1)) * (points.length - 1));
    out.push(
      new Date(points[index].t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  return out;
}

export function StackedMemoryChart({
  points,
  totalBytes,
  height = 180,
}: {
  points: HistoryPoint[];
  totalBytes: number;
  height?: number;
}) {
  const width = 720;
  const padY = 8;
  const innerH = height - padY * 2;
  const max = Math.max(totalBytes, 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labels = tickLabels(points);
  const layers: Array<{
    key: "memUsedBytes" | "memCachedBytes" | "memBuffersBytes" | "memAvailableBytes";
    color: string;
  }> = [
    { key: "memUsedBytes", color: "#c084fc" },
    { key: "memCachedBytes", color: "#60a5fa" },
    { key: "memBuffersBytes", color: "#34d399" },
    { key: "memAvailableBytes", color: "#f59e0b" },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Memory usage"
    >
      {ticks.map((tick) => {
        const y = padY + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1="44" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x="0" y={y + 3} fill="rgba(255,255,255,0.35)" fontSize="10">
              {tick === 0 ? "0" : formatBytes(tick * max, 0)}
            </text>
          </g>
        );
      })}
      {[...layers].reverse().map((layer, reversedIndex) => {
        const index = layers.length - 1 - reversedIndex;
        const d = stackedArea(
          points,
          layers.slice(0, index + 1).map((item) => item.key),
          width - 44,
          innerH,
          max,
        );
        if (!d) return null;
        return (
          <path
            key={layer.key}
            transform="translate(44, 8)"
            d={d}
            fill={layer.color}
            fillOpacity={index === layers.length - 1 ? 0.58 : 0.9}
          />
        );
      })}
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={44 + (index / Math.max(1, labels.length - 1)) * (width - 44)}
          y={height - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function stackedArea(
  points: HistoryPoint[],
  keys: Array<"memUsedBytes" | "memCachedBytes" | "memBuffersBytes" | "memAvailableBytes">,
  width: number,
  height: number,
  max: number,
) {
  if (points.length === 0) return "";
  const stacked = downsampleAvg(
    points.map((point) => keys.reduce((sum, key) => sum + Number(point[key] || 0), 0)),
    CHART_BUCKETS,
  );
  const lowerKeys = keys.slice(0, -1);
  const lower = downsampleAvg(
    points.map((point) => lowerKeys.reduce((sum, key) => sum + Number(point[key] || 0), 0)),
    CHART_BUCKETS,
  );
  return smoothRibbon(
    seriesCoords(stacked, width, height, max, 4),
    seriesCoords(lower, width, height, max, 4),
  );
}

export function DiskIOChart({ points, height = 180 }: { points: HistoryPoint[]; height?: number }) {
  const width = 720;
  const padY = 8;
  const innerH = height - padY * 2;
  const peak = Math.max(
    1,
    ...points.map((point) => Math.max(point.diskReadBps || 0, point.diskWriteBps || 0)),
  );
  const max = niceRateMax(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labels = tickLabels(points);
  const layers: Array<{
    key: "disk" | "diskWriteBps" | "diskReadBps";
    color: string;
    opacity: number;
  }> = [
    { key: "disk", color: "#34d399", opacity: 0.28 },
    { key: "diskWriteBps", color: "#c084fc", opacity: 0.45 },
    { key: "diskReadBps", color: "#60a5fa", opacity: 0.55 },
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Disk usage and I/O"
    >
      {ticks.map((tick) => {
        const y = padY + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1="52" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x="0" y={y + 3} fill="rgba(255,255,255,0.35)" fontSize="10">
              {tick === 0 ? "0" : formatRate(tick * max)}
            </text>
          </g>
        );
      })}
      {layers.map((layer) => {
        const values = points.map((point) =>
          layer.key === "disk" ? ((point.disk || 0) / 100) * max : Number(point[layer.key] || 0),
        );
        const d = areaFromValues(values, width - 52, innerH, max);
        if (!d) return null;
        return (
          <path
            key={layer.key}
            transform="translate(52, 8)"
            d={d}
            fill={layer.color}
            fillOpacity={layer.opacity}
            stroke={layer.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        );
      })}
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={52 + (index / Math.max(1, labels.length - 1)) * (width - 52)}
          y={height - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export function NetworkUsageChart({
  points,
  height = 180,
}: {
  points: HistoryPoint[];
  height?: number;
}) {
  const width = 720;
  const padY = 8;
  const innerH = height - padY * 2;
  const peak = Math.max(1, ...points.map((point) => (point.netRx || 0) + (point.netTx || 0)));
  const max = niceRateMax(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labels = tickLabels(points);
  const layers = [
    { key: "total", color: "#c084fc", opacity: 0.38 },
    { key: "netRx", color: "#60a5fa", opacity: 0.45 },
    { key: "netTx", color: "#f472b6", opacity: 0.5 },
  ] as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Network usage"
    >
      {ticks.map((tick) => {
        const y = padY + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1="52" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x="0" y={y + 3} fill="rgba(255,255,255,0.35)" fontSize="10">
              {tick === 0 ? "0" : formatRate(tick * max)}
            </text>
          </g>
        );
      })}
      {layers.map((layer) => {
        const values = points.map((point) =>
          layer.key === "total"
            ? (point.netRx || 0) + (point.netTx || 0)
            : Number(point[layer.key] || 0),
        );
        const d = areaFromValues(values, width - 52, innerH, max);
        if (!d) return null;
        return (
          <path
            key={layer.key}
            transform="translate(52, 8)"
            d={d}
            fill={layer.color}
            fillOpacity={layer.opacity}
            stroke={layer.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        );
      })}
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={52 + (index / Math.max(1, labels.length - 1)) * (width - 52)}
          y={height - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function areaFromValues(values: number[], width: number, height: number, max: number) {
  const sampled = downsampleAvg(values, CHART_BUCKETS);
  if (sampled.length === 0 || max <= 0) return "";
  return smoothArea(seriesCoords(sampled, width, height, max, 4), width, height);
}

function niceRateMax(bps: number) {
  const units = [1, 1024, 1024 ** 2, 1024 ** 3];
  for (const unit of units) {
    const scaled = bps / unit;
    for (const step of [1, 2, 5, 10, 20, 50, 100, 200, 500]) {
      if (scaled <= step) return step * unit;
    }
  }
  return Math.max(bps, 1);
}

function niceCountMax(value: number) {
  for (const step of [5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 500]) {
    if (value <= step) return step;
  }
  return Math.ceil(value / 100) * 100;
}

import { type ReactNode } from "react";
import { Clock3, Layers, List, MemoryStick, PieChart } from "lucide-react";
import { StackedMemoryChart } from "@/src/components/apps/monitor/charts";
import {
  formatBytes,
  formatCount,
  formatPercent,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import type { ServerInfo } from "@/src/lib/api/server";

const COLORS = {
  used: "#c084fc",
  cached: "#60a5fa",
  buffers: "#34d399",
  available: "#f59e0b",
};

export function MemoryTab({
  snap,
  online,
  chart,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
}) {
  const total = snap?.memoryTotalBytes || 0;
  const used = snap?.memoryUsedBytes || 0;
  const available = snap?.memoryAvailableBytes || Math.max(0, total - used);
  const cached = snap?.memoryCachedBytes || 0;
  const buffers = snap?.memoryBuffersBytes || 0;
  const rest = Math.max(0, total - used - cached - buffers);
  const donut = [
    { label: "Used", color: COLORS.used, value: used },
    { label: "Cached", color: COLORS.cached, value: cached },
    { label: "Buffers", color: COLORS.buffers, value: buffers },
    { label: "Available", color: COLORS.available, value: rest || available },
  ];

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon={<MemoryStick className="size-3.5" />}
          tone="bg-fuchsia-500/15 text-fuchsia-300"
          label="Total Memory"
          value={online ? formatBytes(total) : "—"}
          detail="Physical Memory"
        />
        <Stat
          icon={<PieChart className="size-3.5" />}
          tone="bg-sky-500/15 text-sky-300"
          label="Used Memory"
          value={online ? formatBytes(used) : "—"}
          detail={`${formatPercent(used, total)} of total`}
        />
        <Stat
          icon={<Clock3 className="size-3.5" />}
          tone="bg-emerald-500/15 text-emerald-300"
          label="Available Memory"
          value={online ? formatBytes(available) : "—"}
          detail={`${formatPercent(available, total)} free`}
        />
        <Stat
          icon={<Layers className="size-3.5" />}
          tone="bg-amber-500/15 text-amber-300"
          label="Cached Memory"
          value={online ? formatBytes(cached) : "—"}
          detail={`${formatPercent(cached, total)} of total`}
        />
      </div>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <MemoryStick className="size-4 text-fuchsia-300" />
            Memory Usage
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <Legend color={COLORS.used} label="Used" />
            <Legend color={COLORS.cached} label="Cached" />
            <Legend color={COLORS.buffers} label="Buffers" />
            <Legend color={COLORS.available} label="Available" />
          </ul>
        </div>
        <div className="h-[180px]">
          <StackedMemoryChart points={chart} totalBytes={total} />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
            <PieChart className="size-4 text-white/50" />
            Memory Breakdown
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Donut slices={donut} total={total} />
            <ul className="min-w-[180px] flex-1 space-y-2 text-[12px]">
              {donut.map((slice) => (
                <li key={slice.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-white/70">
                    <span className="size-2 rounded-full" style={{ background: slice.color }} />
                    {slice.label}
                  </span>
                  <span className="tabular-nums text-white/85">
                    {formatBytes(slice.value)}{" "}
                    <span className="text-white/40">{formatPercent(slice.value, total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
            <List className="size-4 text-white/50" />
            Memory Details
          </div>
          <dl className="space-y-2 text-[12px]">
            {detailRows(snap).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-white/40">{label}</dt>
                <dd className="text-right tabular-nums text-white/85">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="sui-glass-card rounded-2xl p-3.5">
      <div className="flex items-center gap-2 text-[12px] text-white/55">
        <span className={`flex size-6 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-white/40">{detail}</p>
    </article>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </li>
  );
}

function Donut({
  slices,
  total,
}: {
  slices: { label: string; color: string; value: number }[];
  total: number;
}) {
  const radius = 42;
  const stroke = 14;
  const circ = 2 * Math.PI * radius;
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0) || total || 1;
  const starts = slices.map((_, index) =>
    slices.slice(0, index).reduce((acc, slice) => acc + (slice.value / sum) * circ, 0),
  );
  return (
    <svg viewBox="0 0 120 120" className="size-[132px] shrink-0">
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      {slices.map((slice, index) => {
        const len = (slice.value / sum) * circ;
        const dash = `${len} ${circ - len}`;
        return (
          <circle
            key={slice.label}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={-(starts[index] || 0)}
            transform="rotate(-90 60 60)"
            strokeLinecap="butt"
          />
        );
      })}
      <text x="60" y="56" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">
        {formatBytes(total, 0)}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">
        Total
      </text>
    </svg>
  );
}

function detailRows(snap: ServerInfo | null): [string, string][] {
  const total = snap?.memoryTotalBytes || 0;
  const used = snap?.memoryUsedBytes || 0;
  const available = snap?.memoryAvailableBytes || 0;
  const cached = snap?.memoryCachedBytes || 0;
  const buffers = snap?.memoryBuffersBytes || 0;
  const swapTotal = snap?.swapTotalBytes || 0;
  const swapUsed = snap?.swapUsedBytes || 0;
  const swapFree = snap?.swapFreeBytes || 0;
  return [
    ["Total Memory", formatBytes(total)],
    ["Used Memory", `${formatBytes(used)} (${formatPercent(used, total)})`],
    ["Available Memory", `${formatBytes(available)} (${formatPercent(available, total)})`],
    ["Cached Memory", `${formatBytes(cached)} (${formatPercent(cached, total)})`],
    ["Buffer Memory", `${formatBytes(buffers)} (${formatPercent(buffers, total)})`],
    ["Swap Total", formatBytes(swapTotal)],
    ["Swap Used", formatBytes(swapUsed)],
    [
      "Swap Free",
      `${formatBytes(swapFree)}${swapTotal ? ` (${formatPercent(swapFree, swapTotal)})` : ""}`,
    ],
    ["Page Faults (Total)", formatCount(snap?.pageFaults || 0)],
    ["Page Faults (Minor)", formatCount(snap?.pageFaultsMinor || 0)],
    ["Page Faults (Major)", formatCount(snap?.pageFaultsMajor || 0)],
  ];
}

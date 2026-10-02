import { Database, Gauge, Thermometer } from "lucide-react";
import { AreaChart, Sparkline, SparklineValues } from "@/src/components/apps/monitor/charts";
import { formatBytes, formatGHz, type HistoryPoint } from "@/src/components/apps/monitor/format";
import type { ServerInfo } from "@/src/lib/api/server";

export function CpuTab({
  snap,
  online,
  chart,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
}) {
  const usage = Math.round(snap?.cpuUsage || 0);
  const logical = snap?.cpuCores || snap?.cores?.length || 0;
  const physical = snap?.cpuPhysicalCores || logical;
  const temp = snap?.cpuTempC || 0;
  const tempLabel = !temp ? "—" : temp < 70 ? "Normal" : temp < 85 ? "Warm" : "Hot";
  const tempColor = !temp
    ? "text-white/40"
    : temp < 70
      ? "text-emerald-300"
      : temp < 85
        ? "text-amber-300"
        : "text-red-300";
  const cores = snap?.cores || [];

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Gauge className="size-3.5" />
            </span>
            CPU Usage
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? `${usage}%` : "—"}
          </p>
          <p className="text-[11px] text-white/40">{cpuUsedDetail(snap)}</p>
          <Sparkline points={chart} series="cpu" color="#34d399" className="mt-1 h-9 w-full" />
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
              <Gauge className="size-3.5" />
            </span>
            Base Frequency
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {formatGHz(snap?.cpuBaseMHz || 0)}
          </p>
          <p className="truncate text-[11px] text-white/40">{snap?.cpuModel || "—"}</p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
              <Database className="size-3.5" />
            </span>
            Cores / Threads
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {logical ? `${physical} / ${logical}` : "—"}
          </p>
          <p className="text-[11px] text-white/40">Physical / Logical</p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Thermometer className="size-3.5" />
            </span>
            Temperature
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {temp ? `${Math.round(temp)}°C` : "—"}
          </p>
          <p className={`text-[11px] ${tempColor}`}>{temp ? `● ${tempLabel}` : "Unavailable"}</p>
        </article>
      </div>

      <section className="mt-3 overflow-hidden sui-glass-card rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <p className="text-[13px] font-medium">CPU Usage History</p>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#34d399]" />
              Total
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#60a5fa]" />
              User
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#fbbf24]" />
              System
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#f87171]" />
              I/O Wait
            </li>
          </ul>
        </div>
        <div className="h-[200px] px-2 pb-2 pt-3">
          <AreaChart
            points={chart}
            series={[
              { key: "cpu", color: "#34d399" },
              { key: "cpuUser", color: "#60a5fa" },
              { key: "cpuSystem", color: "#fbbf24" },
              { key: "cpuIowait", color: "#f87171" },
            ]}
          />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-medium">Per-Core Usage</p>
            <span className="text-[11px] text-white/45">All Cores</span>
          </div>
          {cores.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/40">
              Waiting for per-core samples…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cores.map((core) => (
                <div key={core.id} className="sui-glass-card rounded-xl px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] text-white/55">
                    <span>{core.id}</span>
                    <span className="tabular-nums text-white/80">{Math.round(core.usage)}%</span>
                  </div>
                  <SparklineValues
                    values={chart.map((point) => point.cores?.[core.id] ?? 0)}
                    color="#34d399"
                    className="mt-1 h-7 w-full"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="sui-glass-card rounded-2xl p-4">
          <p className="mb-3 text-[13px] font-medium">CPU Details</p>
          <dl className="space-y-2 text-[12px]">
            {detailRows(snap).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-white/40">{label}</dt>
                <dd className="max-w-[62%] truncate text-right text-white/85">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

function cpuUsedDetail(snap: ServerInfo | null) {
  const logical = snap?.cpuCores || 0;
  if (!logical) return "—";
  const used = ((snap?.cpuUsage || 0) / 100) * logical;
  return `${used.toFixed(1)} / ${logical} vCPUs`;
}

function detailRows(snap: ServerInfo | null): [string, string][] {
  const virt =
    snap?.virtualization && snap.virtualization !== "None"
      ? "Enabled"
      : snap?.virtualization || "—";
  return [
    ["Model", snap?.cpuModel || "—"],
    ["Architecture", snap?.arch || "—"],
    ["Base Frequency", formatGHz(snap?.cpuBaseMHz || 0)],
    ["Max Frequency", formatGHz(snap?.cpuMaxMHz || 0)],
    ["Physical Cores", snap?.cpuPhysicalCores ? String(snap.cpuPhysicalCores) : "—"],
    ["Logical Cores", snap?.cpuCores ? String(snap.cpuCores) : "—"],
    ["Virtualization", virt],
    ["L1 Cache", snap?.l1CacheBytes ? formatBytes(snap.l1CacheBytes, 0) : "—"],
    ["L2 Cache", snap?.l2CacheBytes ? formatBytes(snap.l2CacheBytes, 0) : "—"],
    ["L3 Cache", snap?.l3CacheBytes ? formatBytes(snap.l3CacheBytes, 0) : "—"],
  ];
}

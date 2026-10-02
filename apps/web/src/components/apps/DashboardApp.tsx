"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Box,
  Cpu,
  HardDrive,
  List,
  MemoryStick,
  MoreHorizontal,
  Server,
  Wifi,
} from "lucide-react";
import { AreaChart, Sparkline } from "@/src/components/apps/monitor/charts";
import { CpuTab } from "@/src/components/apps/monitor/CpuTab";
import { DiskTab } from "@/src/components/apps/monitor/DiskTab";
import { MemoryTab } from "@/src/components/apps/monitor/MemoryTab";
import { NetworkTab } from "@/src/components/apps/monitor/NetworkTab";
import { ProcessesTab } from "@/src/components/apps/monitor/ProcessesTab";
import { ServicesTab } from "@/src/components/apps/monitor/ServicesTab";
import {
  filterHistory,
  formatBytes,
  formatRate,
  formatUptime,
  mergeHistory,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import { getServerMetrics, type MonitorProcess, type ServerInfo } from "@/src/lib/api/server";
import { useServer } from "@/src/lib/api/server-context";
import { useSelectedServer } from "@/src/lib/session";

type Tab = "overview" | "cpu" | "memory" | "disk" | "network" | "processes" | "services";
type RangeId = "1m" | "5m" | "1h";
type ProcessSort = "cpu" | "memory";

const RANGE_MS: Record<RangeId, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "1h": 60 * 60_000,
};

const TABS: { id: Tab; label: string; icon: typeof Cpu }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "cpu", label: "CPU", icon: Cpu },
  { id: "memory", label: "Memory", icon: MemoryStick },
  { id: "disk", label: "Disk", icon: HardDrive },
  { id: "network", label: "Network", icon: Wifi },
  { id: "processes", label: "Processes", icon: List },
  { id: "services", label: "Services", icon: Box },
];

const TAB_SELECTED = "#2b7fff";

export function DashboardApp() {
  const selected = useSelectedServer();
  const { server, loading, error } = useServer();
  const [live, setLive] = useState<ServerInfo | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<RangeId>("1h");
  const [processSort, setProcessSort] = useState<ProcessSort>("cpu");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const serverId = selected?.id || server?.id || "";

  useEffect(() => {
    if (!serverId) return undefined;
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      try {
        const next = await getServerMetrics(serverId);
        if (cancelled) return;
        setLive(next);
        setHistory((prev) =>
          mergeHistory(
            prev,
            (next.history || []).map((point) => ({
              t: point.t,
              cpu: point.cpu || 0,
              cpuUser: point.cpuUser || 0,
              cpuSystem: point.cpuSystem || 0,
              cpuIowait: point.cpuIowait || 0,
              memory: point.memory || 0,
              memUsedBytes: point.memUsedBytes || 0,
              memCachedBytes: point.memCachedBytes || 0,
              memBuffersBytes: point.memBuffersBytes || 0,
              memAvailableBytes: point.memAvailableBytes || 0,
              disk: point.disk || 0,
              diskReadBps: point.diskReadBps || 0,
              diskWriteBps: point.diskWriteBps || 0,
              netRx: point.netRx || 0,
              netTx: point.netTx || 0,
              svcRunning: point.svcRunning || 0,
              svcStopped: point.svcStopped || 0,
              svcFailed: point.svcFailed || 0,
              svcOther: point.svcOther || 0,
              cores: point.cores,
            })),
            {
              t: Date.now(),
              cpu: next.cpuUsage || 0,
              cpuUser: next.cpuUser || 0,
              cpuSystem: next.cpuSystem || 0,
              cpuIowait: next.cpuIowait || 0,
              memory: next.memoryUsage || 0,
              memUsedBytes: next.memoryUsedBytes || 0,
              memCachedBytes: next.memoryCachedBytes || 0,
              memBuffersBytes: next.memoryBuffersBytes || 0,
              memAvailableBytes: Math.max(
                0,
                (next.memoryTotalBytes || 0) -
                  (next.memoryUsedBytes || 0) -
                  (next.memoryCachedBytes || 0) -
                  (next.memoryBuffersBytes || 0),
              ),
              disk: next.diskUsage || 0,
              diskReadBps: next.diskReadBps || 0,
              diskWriteBps: next.diskWriteBps || 0,
              netRx: next.netRxBps || 0,
              netTx: next.netTxBps || 0,
              svcRunning: next.serviceRunning || 0,
              svcStopped: next.serviceStopped || 0,
              svcFailed: next.serviceFailed || 0,
              svcOther: next.serviceOther || 0,
              cores: (next.cores || []).map((core) => core.usage),
            },
          ),
        );
      } catch {
        if (!cancelled) {
          /* keep last good sample */
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(() => void tick(), 2000);
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serverId]);

  const snap = live || server;
  const online = snap?.status === "online";
  const chart = filterHistory(history, RANGE_MS[range]);
  const processes = useMemo(() => {
    const list = [...(snap?.processes || [])];
    list.sort((a, b) => (processSort === "cpu" ? b.cpu - a.cpu : b.memory - a.memory));
    return list;
  }, [snap?.processes, processSort]);
  const TabIcon = TABS.find((item) => item.id === tab)?.icon || Activity;

  return (
    <div className="sui-app flex h-full min-h-0 overflow-hidden">
      <aside className="sui-sidebar flex w-[188px] shrink-0 flex-col px-3 py-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#2b7fff]/20 text-[#6ea8ff]">
            <Activity className="size-4" />
          </span>
          <p className="text-[13px] font-semibold tracking-tight">System Monitor</p>
        </div>
        <nav aria-label="Monitor sections" className="flex flex-col gap-0.5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] outline-none transition ${
                  active ? "text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
                }`}
                style={
                  active
                    ? { background: TAB_SELECTED, boxShadow: `0 8px 24px ${TAB_SELECTED}47` }
                    : undefined
                }
              >
                <Icon className="size-4 opacity-90" strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-5 py-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#2b7fff]/20 text-[#8eb6ff]">
              <TabIcon className="size-5" />
            </span>
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight">
                {tab === "overview"
                  ? "System Overview"
                  : TABS.find((item) => item.id === tab)?.label}
              </h3>
              <p className="text-[12px] text-white/45">
                {tabCopy(tab, Boolean(online), loading, error)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab !== "processes" && tab !== "services" ? (
              <>
                <label className="sr-only" htmlFor="monitor-range">
                  Time range
                </label>
                <select
                  id="monitor-range"
                  value={range}
                  onChange={(event) => setRange(event.target.value as RangeId)}
                  className="rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
                >
                  <option value="1m">Last 1 Minute</option>
                  <option value="5m">Last 5 Minutes</option>
                  <option value="1h">Last 1 Hour</option>
                </select>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/6 p-1.5 text-white/70"
              aria-label="More"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        </header>

        {tab === "overview" ? (
          <Overview
            snap={snap}
            online={Boolean(online)}
            chart={chart}
            processes={processes}
            processSort={processSort}
            onSort={setProcessSort}
          />
        ) : null}
        {tab === "cpu" ? <CpuTab snap={snap} online={Boolean(online)} chart={chart} /> : null}
        {tab === "memory" ? <MemoryTab snap={snap} online={Boolean(online)} chart={chart} /> : null}
        {tab === "disk" ? <DiskTab snap={snap} online={Boolean(online)} chart={chart} /> : null}
        {tab === "network" ? (
          <NetworkTab
            snap={snap}
            online={Boolean(online)}
            chart={chart}
            rangeLabel={
              range === "1m"
                ? "in last minute"
                : range === "5m"
                  ? "in last 5 minutes"
                  : "in last hour"
            }
          />
        ) : null}
        {tab === "processes" ? (
          <ProcessesTab
            snap={snap}
            online={Boolean(online)}
            chart={chart}
            range={range}
            onRange={setRange}
          />
        ) : null}
        {tab === "services" ? (
          <ServicesTab
            snap={snap}
            online={Boolean(online)}
            chart={chart}
            onRefresh={() => {
              if (!serverId) return;
              void getServerMetrics(serverId)
                .then((next) => setLive(next))
                .catch(() => undefined);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Overview({
  snap,
  online,
  chart,
  processes,
  processSort,
  onSort,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
  processes: MonitorProcess[];
  processSort: ProcessSort;
  onSort: (value: ProcessSort) => void;
}) {
  const cpu = Math.round(snap?.cpuUsage || 0);
  const mem = Math.round(snap?.memoryUsage || 0);
  const disk = Math.round(snap?.diskUsage || 0);
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={<Cpu className="size-3.5" />}
          iconClass="bg-emerald-500/15 text-emerald-300"
          label="CPU"
          value={online ? `${cpu}%` : "—"}
          detail={cpuDetail(snap)}
        >
          <Sparkline points={chart} series="cpu" color="#34d399" className="h-10 w-full" />
        </StatCard>
        <StatCard
          icon={<MemoryStick className="size-3.5" />}
          iconClass="bg-fuchsia-500/15 text-fuchsia-300"
          label="Memory"
          value={online ? `${mem}%` : "—"}
          detail={
            snap?.memoryTotalBytes
              ? `${formatBytes(snap.memoryUsedBytes || 0)} / ${formatBytes(snap.memoryTotalBytes)}`
              : "—"
          }
        >
          <Sparkline points={chart} series="memory" color="#c084fc" className="h-10 w-full" />
        </StatCard>
        <StatCard
          icon={<HardDrive className="size-3.5" />}
          iconClass="bg-sky-500/15 text-sky-300"
          label="Disk"
          value={online ? `${disk}%` : "—"}
          detail={
            snap?.diskTotalBytes
              ? `${formatBytes(snap.diskUsedBytes || 0)} / ${formatBytes(snap.diskTotalBytes)}`
              : "—"
          }
        >
          <Sparkline points={chart} series="disk" color="#60a5fa" className="h-10 w-full" />
        </StatCard>
        <StatCard
          icon={<Wifi className="size-3.5" />}
          iconClass="bg-pink-500/15 text-pink-300"
          label="Network"
          value={online ? `↓ ${formatRate(snap?.netRxBps || 0)}` : "—"}
          detail={online ? `↑ ${formatRate(snap?.netTxBps || 0)}` : "—"}
        >
          <Sparkline
            points={chart}
            series="netRx"
            color="#f472b6"
            max={Math.max(1, ...chart.map((p) => Math.max(p.netRx, p.netTx)))}
            className="h-10 w-full"
          />
        </StatCard>
      </div>

      <section className="mt-3 overflow-hidden sui-glass-card rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <HardDrive className="size-4 text-white/50" />
            Resource Usage
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <Legend color="#34d399" label="CPU" />
            <Legend color="#c084fc" label="Memory" />
            <Legend color="#60a5fa" label="Disk" />
            <Legend color="#f472b6" label="Network" />
          </ul>
        </div>
        <div className="h-[200px] px-2 pb-2 pt-3">
          <AreaChart
            points={chart}
            series={[
              { key: "cpu", color: "#34d399" },
              { key: "memory", color: "#c084fc" },
              { key: "disk", color: "#60a5fa" },
              { key: "netRx", color: "#f472b6" },
            ]}
          />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <ProcessTable processes={processes} sort={processSort} onSort={onSort} />
        <SystemInfo snap={snap} />
      </div>
    </>
  );
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
  detail,
  children,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <article className="sui-glass-card rounded-2xl p-3.5">
      <div className="flex items-center gap-2 text-[12px] text-white/55">
        <span className={`flex size-6 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-white/40">{detail}</p>
      <div className="mt-1 overflow-hidden">{children}</div>
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

function ProcessTable({
  processes,
  sort,
  onSort,
}: {
  processes: MonitorProcess[];
  sort: ProcessSort;
  onSort: (value: ProcessSort) => void;
}) {
  return (
    <section className="sui-glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <List className="size-4 text-white/50" />
          Top Processes
        </div>
        <select
          aria-label="Sort processes"
          value={sort}
          onChange={(event) => onSort(event.target.value as ProcessSort)}
          className="rounded-md border border-white/10 bg-white/6 px-2 py-1 text-[11px] text-white/75 outline-none"
        >
          <option value="cpu">CPU Usage</option>
          <option value="memory">Memory</option>
        </select>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead className="text-[11px] text-white/40">
            <tr>
              <th className="pb-2 font-medium">PID</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">CPU</th>
              <th className="pb-2 font-medium">Memory</th>
            </tr>
          </thead>
          <tbody>
            {processes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-white/40">
                  No process data yet.
                </td>
              </tr>
            ) : (
              processes.map((proc) => (
                <tr key={`${proc.pid}-${proc.name}`} className="border-t border-white/6">
                  <td className="py-2 tabular-nums text-white/45">{proc.pid}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <ProcessGlyph name={proc.name} />
                      {proc.name}
                    </span>
                  </td>
                  <td className="py-2 tabular-nums">{proc.cpu.toFixed(1)}%</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      {formatBytes(proc.memoryBytes)}
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full bg-emerald-400"
                          style={{ width: `${Math.min(100, proc.memory * 4)}%` }}
                        />
                      </span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SystemInfo({ snap }: { snap: ServerInfo | null }) {
  const rows = [
    ["Hostname", snap?.hostname || "—"],
    ["Operating System", snap?.osName || "—"],
    ["Kernel", snap?.kernel || "—"],
    ["Uptime", formatUptime(snap?.uptimeSeconds || 0)],
    [
      "Load Average",
      snap
        ? `${(snap.load1 || 0).toFixed(2)}, ${(snap.load5 || 0).toFixed(2)}, ${(snap.load15 || 0).toFixed(2)}`
        : "—",
    ],
    ["CPU", cpuInfo(snap)],
    ["Memory", snap?.memoryTotalBytes ? formatBytes(snap.memoryTotalBytes, 0) : "—"],
    ["Disk", snap?.diskTotalBytes ? `${formatBytes(snap.diskTotalBytes)}` : "—"],
    ["Architecture", snap?.arch || "—"],
    ["Virtualization", snap?.virtualization || "—"],
    ["IP Address", snap?.ipAddress || snap?.host || "—"],
    ["Docker Version", snap?.dockerVersion || "—"],
    ["Running Containers", snap?.containerCount != null ? String(snap.containerCount) : "—"],
  ];
  return (
    <section className="sui-glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
        <Server className="size-4 text-white/50" />
        System Information
      </div>
      <dl className="space-y-2 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt className="text-white/40">{label}</dt>
            <dd className="max-w-[60%] truncate text-right text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProcessGlyph({ name }: { name: string }) {
  const tone = PROCESS_COLORS[name.toLowerCase()] || "#64748b";
  return (
    <span
      className="flex size-5 items-center justify-center rounded-md text-[10px] font-semibold text-white"
      style={{ background: tone }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function tabCopy(tab: Tab, online: boolean, loading: boolean, error: string | null) {
  if (!online) {
    if (loading) return "Connecting to the server…";
    return error || "Metrics unavailable.";
  }
  if (tab === "cpu") return "Detailed information about your server's CPU performance.";
  if (tab === "memory")
    return "Detailed information about your server's memory usage and statistics.";
  if (tab === "disk") return "Detailed information about your server's disk usage and performance.";
  if (tab === "network")
    return "Detailed information about your server's network usage and connections.";
  if (tab === "processes") return "View and manage running processes on your server.";
  if (tab === "services") return "Manage and monitor system services, daemons, and applications.";
  return "Real-time overview of your server's health and performance.";
}

function cpuDetail(snap: ServerInfo | null) {
  if (!snap?.cpuCores) return "—";
  const used = ((snap.cpuUsage || 0) / 100) * snap.cpuCores;
  return `${used.toFixed(1)} / ${snap.cpuCores} vCPUs`;
}

function cpuInfo(snap: ServerInfo | null) {
  if (!snap) return "—";
  if (snap.cpuModel && snap.cpuCores) return `${snap.cpuModel} (${snap.cpuCores} vCPUs)`;
  if (snap.cpuCores) return `${snap.cpuCores} vCPUs`;
  return snap.cpuModel || "—";
}

const PROCESS_COLORS: Record<string, string> = {
  node: "#3c873a",
  docker: "#2496ed",
  dockerd: "#2496ed",
  postgres: "#336791",
  ollama: "#111827",
  caddy: "#22c55e",
  nginx: "#009639",
  containerd: "#0298c3",
  redis: "#dc2626",
  "redis-server": "#dc2626",
  sshd: "#64748b",
  systemd: "#94a3b8",
};

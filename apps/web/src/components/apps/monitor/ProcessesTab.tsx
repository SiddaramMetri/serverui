import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, List, MemoryStick, MoreHorizontal, Search, Settings2 } from "lucide-react";
import { ProcessUsageChart, Sparkline } from "@/src/components/apps/monitor/charts";
import {
  formatBytes,
  formatPercent,
  formatUptime,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import {
  getProcessInspect,
  killServerProcess,
  type MonitorProcess,
  type ProcessInspect,
  type ServerInfo,
} from "@/src/lib/api/server";
import { useSelectedServer } from "@/src/lib/session";

type FilterId = "all" | "user" | "system" | "running";
type SortId = "cpu" | "memory" | "threads";
type DetailTab = "overview" | "files" | "network" | "env";

export function ProcessesTab({
  snap,
  online,
  chart,
  range,
  onRange,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
  range: "1m" | "5m" | "1h";
  onRange: (value: "1m" | "5m" | "1h") => void;
}) {
  const selected = useSelectedServer();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("cpu");
  const [activePid, setActivePid] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [inspect, setInspect] = useState<ProcessInspect | null>(null);
  const [busy, setBusy] = useState(false);

  const processes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(snap?.processes || [])].filter((proc) => {
      if (filter === "user" && isSystemProc(proc)) return false;
      if (filter === "system" && !isSystemProc(proc)) return false;
      if (filter === "running" && !String(proc.state || "").startsWith("R")) return false;
      if (!q) return true;
      return (
        proc.name.toLowerCase().includes(q) ||
        String(proc.pid).includes(q) ||
        (proc.user || "").toLowerCase().includes(q) ||
        (proc.command || "").toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      if (sort === "memory") return b.memoryBytes - a.memoryBytes;
      if (sort === "threads") return (b.threads || 0) - (a.threads || 0);
      return b.cpu - a.cpu;
    });
    return list;
  }, [snap?.processes, query, filter, sort]);

  const active = processes.find((proc) => proc.pid === activePid) || processes[0] || null;

  useEffect(() => {
    if (!selected?.id || !active?.pid || !online) return undefined;
    const pid = active.pid;
    let cancelled = false;
    void getProcessInspect(selected.id, pid)
      .then((next) => {
        if (!cancelled) setInspect(next);
      })
      .catch(() => {
        if (!cancelled) setInspect(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, active?.pid, online]);

  const total = snap?.processCount || processes.length;
  const userCount = snap?.processUserCount || 0;
  const sysCount = snap?.processSysCount || 0;
  const running = snap?.processRunning || 0;
  const procCPU = processes.reduce((sum, proc) => sum + (proc.cpu || 0), 0);
  const procMem = processes.reduce((sum, proc) => sum + (proc.memoryBytes || 0), 0);
  const ram = snap?.memoryTotalBytes || 0;

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search processes..."
            className="w-52 rounded-lg border border-white/10 bg-white/6 py-1.5 pl-8 pr-2.5 text-[12px] text-white/80 outline-none placeholder:text-white/35"
          />
        </label>
        <select
          aria-label="Filter processes"
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterId)}
          className="rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
        >
          <option value="all">All Processes</option>
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="running">Running</option>
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-slate-500/20 text-slate-200">
              <Settings2 className="size-3.5" />
            </span>
            Total Processes
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? total : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {userCount} user / {sysCount} system
          </p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Cpu className="size-3.5" />
            </span>
            CPU Usage (Processes)
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? `${Math.round(snap?.cpuUsage || 0)}%` : "—"}
          </p>
          <p className="text-[11px] text-white/40">{procCPU.toFixed(1)}% total process CPU</p>
          <Sparkline points={chart} series="cpu" color="#34d399" className="mt-1 h-9 w-full" />
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <MemoryStick className="size-3.5" />
            </span>
            Memory Usage (Processes)
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? formatBytes(procMem || snap?.memoryUsedBytes || 0) : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {formatPercent(procMem || snap?.memoryUsedBytes || 0, ram)} of total RAM
          </p>
          <Sparkline points={chart} series="memory" color="#c084fc" className="mt-1 h-9 w-full" />
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Activity className="size-3.5" />
            </span>
            Active Processes
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? running : "—"}
          </p>
          <p className="text-[11px] text-white/40">Running normally</p>
        </article>
      </div>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Activity className="size-4 text-emerald-300" />
            Process Resource Usage
          </div>
          <div className="flex items-center gap-3">
            <ul className="flex gap-3 text-[11px] text-white/55">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                CPU
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-violet-400" />
                Memory
              </li>
            </ul>
            <select
              aria-label="Chart time range"
              value={range}
              onChange={(event) => onRange(event.target.value as "1m" | "5m" | "1h")}
              className="rounded-lg border border-white/10 bg-white/6 px-2 py-1 text-[11px] text-white/75 outline-none"
            >
              <option value="1m">Last 1 Minute</option>
              <option value="5m">Last 5 Minutes</option>
              <option value="1h">Last 1 Hour</option>
            </select>
          </div>
        </div>
        <div className="h-[180px]">
          <ProcessUsageChart points={chart} />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <List className="size-4 text-white/50" />
              Top Processes
            </div>
            <select
              aria-label="Sort processes"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortId)}
              className="rounded-md border border-white/10 bg-white/6 px-2 py-1 text-[11px] text-white/75 outline-none"
            >
              <option value="cpu">CPU Usage</option>
              <option value="memory">Memory</option>
              <option value="threads">Threads</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead className="text-[11px] text-white/40">
                <tr>
                  <th className="pb-2 font-medium">PID</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">CPU</th>
                  <th className="pb-2 font-medium">Memory</th>
                  <th className="pb-2 font-medium">Threads</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-white/40">
                      {online ? "No matching processes." : "—"}
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr
                      key={`${proc.pid}-${proc.name}`}
                      className={`cursor-pointer border-t border-white/6 ${active?.pid === proc.pid ? "bg-white/6" : "hover:bg-white/4"}`}
                      onClick={() => setActivePid(proc.pid)}
                    >
                      <td className="py-2.5 tabular-nums text-white/45">{proc.pid}</td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <ProcessGlyph name={proc.name} />
                          {proc.name}
                        </span>
                      </td>
                      <td className="py-2.5 tabular-nums">{proc.cpu.toFixed(1)}%</td>
                      <td className="py-2.5 tabular-nums text-white/70">
                        {formatBytes(proc.memoryBytes)}
                      </td>
                      <td className="py-2.5 tabular-nums text-white/70">{proc.threads || 1}</td>
                      <td className="py-2.5 text-white/70">{proc.user || "—"}</td>
                      <td className="py-2.5 text-right text-white/30">
                        <MoreHorizontal className="ml-auto size-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ProcessDetails
          proc={active}
          inspect={inspect}
          tab={detailTab}
          onTab={setDetailTab}
          processes={snap?.processes || []}
          ram={ram}
          busy={busy}
          online={online}
          onKill={async () => {
            if (!selected?.id || !active?.pid || active.pid <= 1) return;
            if (!window.confirm(`Send SIGTERM to ${active.name} (PID ${active.pid})?`)) return;
            setBusy(true);
            try {
              await killServerProcess(selected.id, active.pid);
              setActivePid(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </>
  );
}

function ProcessDetails({
  proc,
  inspect,
  tab,
  onTab,
  processes,
  ram,
  busy,
  online,
  onKill,
}: {
  proc: MonitorProcess | null;
  inspect: ProcessInspect | null;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  processes: MonitorProcess[];
  ram: number;
  busy: boolean;
  online: boolean;
  onKill: () => void;
}) {
  const parent = processes.find((item) => item.pid === proc?.ppid);
  const started = proc?.elapsedSeconds ? formatUptime(proc.elapsedSeconds) : "—";
  return (
    <section className="sui-glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {proc ? <ProcessGlyph name={proc.name} className="size-8 text-[13px]" /> : null}
          <div>
            <p className="text-[14px] font-semibold">{proc?.name || "No process selected"}</p>
            <p className="text-[11px] text-white/40">
              {proc ? `PID ${proc.pid} · ${proc.user || "—"}` : "Select a row to inspect."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!online || !proc || proc.pid <= 1 || busy}
            onClick={onKill}
            className="rounded-lg bg-[#2b7fff] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
          >
            Kill Process
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 p-1 text-white/45"
            aria-label="Process actions"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
      <div className="mb-3 flex gap-4 border-b border-white/8 text-[12px]">
        {(
          [
            ["overview", "Overview"],
            ["files", "Open Files"],
            ["network", "Network"],
            ["env", "Environment"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`-mb-px border-b-2 pb-2 ${tab === id ? "border-violet-400 text-white" : "border-transparent text-white/45"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <dl className="space-y-2 text-[12px]">
          {detailRows(proc, inspect, parent, started, ram).map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-white/40">{label}</dt>
              <dd className="max-w-[62%] break-all text-right text-white/85">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tab === "files" ? (
        <LineList items={inspect?.openFiles || []} empty="No open files reported." />
      ) : null}
      {tab === "network" ? (
        <LineList items={inspect?.sockets || []} empty="No sockets reported." />
      ) : null}
      {tab === "env" ? (
        <LineList items={inspect?.environ || []} empty="No environment reported." />
      ) : null}
    </section>
  );
}

function detailRows(
  proc: MonitorProcess | null,
  inspect: ProcessInspect | null,
  parent: MonitorProcess | undefined,
  started: string,
  ram: number,
): [string, string][] {
  if (!proc) return [];
  const command = inspect?.command || proc.command || proc.name;
  const cwd = inspect?.cwd || proc.cwd || "—";
  const parentLabel = parent
    ? `${parent.name} (PID ${parent.pid})`
    : proc.ppid
      ? `PID ${proc.ppid}`
      : "—";
  return [
    ["Command", command],
    ["Working Directory", cwd],
    ["User", proc.user || "—"],
    ["Started At", started],
    ["Uptime", formatUptime(proc.elapsedSeconds || 0)],
    ["CPU Usage", `${proc.cpu.toFixed(1)}%`],
    ["Memory Usage", `${formatBytes(proc.memoryBytes)} (${formatPercent(proc.memoryBytes, ram)})`],
    ["Threads", String(proc.threads || 1)],
    ["Parent Process", parentLabel],
  ];
}

function LineList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[12px] text-white/40">{empty}</p>;
  }
  return (
    <ul className="max-h-[280px] space-y-1 overflow-auto font-mono text-[11px] text-white/70">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="break-all">
          {item}
        </li>
      ))}
    </ul>
  );
}

function isSystemProc(proc: MonitorProcess) {
  return proc.user === "root" || proc.name.startsWith("[");
}

function ProcessGlyph({
  name,
  className = "size-5 text-[10px]",
}: {
  name: string;
  className?: string;
}) {
  const tone = PROCESS_COLORS[name.toLowerCase()] || "#64748b";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md font-semibold text-white ${className}`}
      style={{ background: tone }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const PROCESS_COLORS: Record<string, string> = {
  node: "#3c873a",
  docker: "#2496ed",
  dockerd: "#2496ed",
  postgres: "#336791",
  ollama: "#111827",
  nginx: "#009639",
  containerd: "#0298c3",
  redis: "#dc2626",
  "redis-server": "#dc2626",
  sshd: "#64748b",
  ssh: "#64748b",
  systemd: "#94a3b8",
  tailscaled: "#111827",
};

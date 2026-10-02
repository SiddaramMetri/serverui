import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  CircleStop,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Square,
} from "lucide-react";
import { ServiceStatusChart, Sparkline } from "@/src/components/apps/monitor/charts";
import {
  formatBytes,
  formatPercent,
  formatUptime,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import { controlServerService, type ServerInfo } from "@/src/lib/api/server";
import { useSelectedServer } from "@/src/lib/session";

type FilterId = "all" | "running" | "stopped" | "failed";

export function ServicesTab({
  snap,
  online,
  chart,
  onRefresh,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
  onRefresh: () => void;
}) {
  const selected = useSelectedServer();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const running = snap?.serviceRunning || 0;
  const stopped = snap?.serviceStopped || 0;
  const failed = snap?.serviceFailed || 0;
  const total =
    (snap?.services || []).length || running + stopped + failed + (snap?.serviceOther || 0);
  const sparkMax = Math.max(total, 4);

  const services = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(snap?.services || [])].filter((svc) => {
      if (filter !== "all" && svc.state !== filter) return false;
      if (!q) return true;
      return (
        svc.name.toLowerCase().includes(q) ||
        (svc.description || "").toLowerCase().includes(q) ||
        (svc.state || "").toLowerCase().includes(q)
      );
    });
  }, [snap?.services, query, filter]);

  async function act(name: string, action: "start" | "stop" | "restart") {
    if (!selected?.id || !online) return;
    const label = action === "stop" ? "stop" : action;
    if (!window.confirm(`${label} ${name}?`)) return;
    setBusy(`${name}:${action}`);
    try {
      await controlServerService(selected.id, name, action);
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services..."
            className="w-52 rounded-lg border border-white/10 bg-white/6 py-1.5 pl-8 pr-2.5 text-[12px] text-white/80 outline-none placeholder:text-white/35"
          />
        </label>
        <select
          aria-label="Filter services"
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterId)}
          className="rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
        >
          <option value="all">All Services</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Box className="size-3.5" />
            </span>
            Total Services
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? total : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {running} running | {stopped} stopped
          </p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Play className="size-3.5" />
            </span>
            Running
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? running : "—"}
          </p>
          <p className="text-[11px] text-white/40">{formatPercent(running, total)} of total</p>
          <Sparkline
            points={chart}
            series="svcRunning"
            color="#34d399"
            max={sparkMax}
            className="mt-1 h-9 w-full"
          />
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
              <Square className="size-3.5" />
            </span>
            Stopped
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? stopped : "—"}
          </p>
          <p className="text-[11px] text-white/40">{formatPercent(stopped, total)} of total</p>
          <Sparkline
            points={chart}
            series="svcStopped"
            color="#fb7185"
            max={sparkMax}
            className="mt-1 h-9 w-full"
          />
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <AlertTriangle className="size-3.5" />
            </span>
            Failed
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? failed : "—"}
          </p>
          <p className="text-[11px] text-white/40">{formatPercent(failed, total)} of total</p>
          <Sparkline
            points={chart}
            series="svcFailed"
            color="#fbbf24"
            max={sparkMax}
            className="mt-1 h-9 w-full"
          />
        </article>
      </div>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Box className="size-4 text-emerald-300" />
            Service Status
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              Running
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-400" />
              Stopped
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400" />
              Failed
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-400" />
              Other
            </li>
          </ul>
        </div>
        <div className="h-[180px]">
          <ServiceStatusChart points={chart} />
        </div>
      </section>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Box className="size-4 text-white/50" />
            Service List
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", `All (${total})`],
                ["running", `Running (${running})`],
                ["stopped", `Stopped (${stopped})`],
                ["failed", `Failed (${failed})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  filter === id
                    ? "bg-violet-500/80 text-white"
                    : "bg-white/6 text-white/55 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onRefresh}
              className="ml-1 rounded-lg border border-white/10 p-1.5 text-white/55"
              aria-label="Refresh services"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="text-[11px] text-white/40">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">CPU</th>
                <th className="pb-2 font-medium">Memory</th>
                <th className="pb-2 font-medium">Uptime</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-white/40">
                    {online ? "No matching services." : "—"}
                  </td>
                </tr>
              ) : (
                services.map((svc) => (
                  <tr key={svc.name} className="border-t border-white/6">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <ServiceGlyph name={svc.name} />
                        {svc.name}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 text-white/55">
                      {svc.description || "—"}
                    </td>
                    <td className="py-2.5">
                      <StatusPill state={svc.state} />
                    </td>
                    <td className="py-2.5 text-white/55">{svc.type || "system"}</td>
                    <td className="py-2.5 tabular-nums">
                      {svc.cpu ? `${svc.cpu.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 tabular-nums text-white/70">
                      {svc.memoryBytes ? formatBytes(svc.memoryBytes) : "—"}
                    </td>
                    <td className="py-2.5 text-white/55">
                      {svc.uptimeSeconds ? formatUptime(svc.uptimeSeconds) : "—"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton
                          label={`Start ${svc.name}`}
                          disabled={!online || busy !== null}
                          onClick={() =>
                            void act(svc.name, svc.state === "running" ? "restart" : "start")
                          }
                        >
                          <Play className="size-3" />
                        </ActionButton>
                        <ActionButton
                          label={`Stop ${svc.name}`}
                          disabled={!online || busy !== null || svc.state === "stopped"}
                          onClick={() => void act(svc.name, "stop")}
                        >
                          <CircleStop className="size-3" />
                        </ActionButton>
                        <button
                          type="button"
                          className="rounded-md p-1 text-white/30"
                          aria-label={`${svc.name} more`}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-white/10 p-1 text-white/60 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function StatusPill({ state }: { state: string }) {
  const tone =
    state === "running"
      ? "bg-emerald-500/15 text-emerald-300"
      : state === "failed"
        ? "bg-rose-500/15 text-rose-300"
        : state === "stopped"
          ? "bg-white/10 text-white/55"
          : "bg-amber-500/15 text-amber-300";
  const label = state ? state[0].toUpperCase() + state.slice(1) : "Unknown";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${tone}`}>{label}</span>;
}

function ServiceGlyph({ name }: { name: string }) {
  const tone = SERVICE_COLORS[name.toLowerCase()] || "#64748b";
  return (
    <span
      className="flex size-5 items-center justify-center rounded-md text-[10px] font-semibold text-white"
      style={{ background: tone }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const SERVICE_COLORS: Record<string, string> = {
  nginx: "#009639",
  node: "#3c873a",
  postgresql: "#336791",
  postgres: "#336791",
  redis: "#dc2626",
  docker: "#2496ed",
  ssh: "#64748b",
  sshd: "#64748b",
  fail2ban: "#111827",
  ufw: "#f97316",
};

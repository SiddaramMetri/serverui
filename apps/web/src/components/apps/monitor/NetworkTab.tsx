import { ArrowDown, ArrowUp, Download, Globe, List, Upload, Wifi } from "lucide-react";
import { NetworkUsageChart } from "@/src/components/apps/monitor/charts";
import {
  formatBytes,
  formatCount,
  formatRate,
  trafficBytes,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import type { ServerInfo } from "@/src/lib/api/server";

export function NetworkTab({
  snap,
  online,
  chart,
  rangeLabel,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
  rangeLabel: string;
}) {
  const rx = snap?.netRxBps || 0;
  const tx = snap?.netTxBps || 0;
  const total = rx + tx;
  const rxWindow = trafficBytes(chart, "netRx");
  const txWindow = trafficBytes(chart, "netTx");
  const processes = [...(snap?.netProcesses || [])];
  const ports = (snap?.netListenPorts || []).join(", ");

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Wifi className="size-3.5" />
            </span>
            Total Bandwidth
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? formatRate(total) : "—"}
          </p>
          <p className="flex items-center gap-2 text-[11px] text-white/45">
            <span className="inline-flex items-center gap-0.5 text-sky-300">
              <ArrowDown className="size-3" />
              {formatRate(rx)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-rose-300">
              <ArrowUp className="size-3" />
              {formatRate(tx)}
            </span>
          </p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Download className="size-3.5" />
            </span>
            Download (RX)
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? formatRate(rx) : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {formatBytes(rxWindow)} {rangeLabel}
          </p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
              <Upload className="size-3.5" />
            </span>
            Upload (TX)
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? formatRate(tx) : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {formatBytes(txWindow)} {rangeLabel}
          </p>
        </article>
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
              <Globe className="size-3.5" />
            </span>
            Active Connections
          </div>
          <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight">
            {online ? formatCount(snap?.netConns || 0) : "—"}
          </p>
          <p className="text-[11px] text-white/40">
            {formatCount(snap?.netEstablished || 0)} established
          </p>
        </article>
      </div>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Wifi className="size-4 text-violet-300" />
            Network Usage
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-400" />
              Download (RX)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-400" />
              Upload (TX)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-violet-400" />
              Total
            </li>
          </ul>
        </div>
        <div className="h-[180px]">
          <NetworkUsageChart points={chart} />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
            <Wifi className="size-4 text-violet-300" />
            Top Network Processes
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead className="text-[11px] text-white/40">
                <tr>
                  <th className="pb-2 font-medium">PID</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 text-right font-medium">Download</th>
                  <th className="pb-2 text-right font-medium">Upload</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {!online || processes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-white/40">
                      {online ? "No per-process sockets reported." : "—"}
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr key={`${proc.pid}-${proc.name}`} className="border-t border-white/6">
                      <td className="py-2.5 tabular-nums text-white/55">{proc.pid}</td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <ProcessGlyph name={proc.name} />
                          {proc.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">
                        {formatRate(proc.rxBps)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">
                        {formatRate(proc.txBps)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-white/85">
                        {formatRate(proc.rxBps + proc.txBps)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
            <List className="size-4 text-white/50" />
            Network Details
          </div>
          <dl className="space-y-2 text-[12px]">
            {detailRows(snap, ports).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-white/40">{label}</dt>
                <dd className="max-w-[58%] break-all text-right tabular-nums text-white/85">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

function detailRows(snap: ServerInfo | null, ports: string): [string, string][] {
  return [
    ["Primary Interface", snap?.netIface || "—"],
    ["Interface Type", snap?.netIfaceType || "—"],
    ["MAC Address", snap?.netMAC || "—"],
    ["IP Address (IPv4)", snap?.netIPv4 || snap?.ipAddress || "—"],
    ["IP Address (IPv6)", snap?.netIPv6 || "—"],
    ["Subnet Mask", snap?.netSubnet || "—"],
    ["Gateway", snap?.netGateway || "—"],
    ["DNS Servers", snap?.netDNS || "—"],
    ["Total Received", formatBytes(snap?.netRxBytes || 0)],
    ["Total Transmitted", formatBytes(snap?.netTxBytes || 0)],
    ["Active Connections", formatCount(snap?.netConns || 0)],
    ["Listening Ports", ports || "—"],
  ];
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
  systemd: "#94a3b8",
};

import { type ReactNode } from "react";
import { ArrowDown, ArrowUp, Database, Folder, HardDrive, List, Triangle } from "lucide-react";
import { DiskIOChart } from "@/src/components/apps/monitor/charts";
import {
  formatBytes,
  formatCount,
  formatPercent,
  formatRate,
  type HistoryPoint,
} from "@/src/components/apps/monitor/format";
import type { MonitorDiskMount, ServerInfo } from "@/src/lib/api/server";

export function DiskTab({
  snap,
  online,
  chart,
}: {
  snap: ServerInfo | null;
  online: boolean;
  chart: HistoryPoint[];
}) {
  const total = snap?.diskTotalBytes || 0;
  const used = snap?.diskUsedBytes || 0;
  const free = snap?.diskFreeBytes || Math.max(0, total - used);
  const mounts = [...(snap?.diskMounts || [])].sort(sortMounts);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon={<Database className="size-3.5" />}
          tone="bg-sky-500/15 text-sky-300"
          label="Total Disk Space"
          value={online ? formatBytes(total) : "—"}
          detail={snap?.diskType || "Physical Disk"}
        />
        <Stat
          icon={<HardDrive className="size-3.5" />}
          tone="bg-emerald-500/15 text-emerald-300"
          label="Used Space"
          value={online ? formatBytes(used) : "—"}
          detail={`${formatPercent(used, total)} of total`}
        />
        <Stat
          icon={<Database className="size-3.5" />}
          tone="bg-amber-500/15 text-amber-300"
          label="Free Space"
          value={online ? formatBytes(free) : "—"}
          detail={`${formatPercent(free, total)} free`}
        />
        <article className="sui-glass-card rounded-2xl p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/55">
            <span className="flex size-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <HardDrive className="size-3.5" />
            </span>
            Read / Write Speed
          </div>
          <div className="mt-2 space-y-1 text-[15px] font-semibold tabular-nums">
            <p className="flex items-center gap-1.5 text-sky-300">
              <ArrowDown className="size-3.5" />
              {online ? formatRate(snap?.diskReadBps || 0) : "—"}
            </p>
            <p className="flex items-center gap-1.5 text-rose-300">
              <ArrowUp className="size-3.5" />
              {online ? formatRate(snap?.diskWriteBps || 0) : "—"}
            </p>
          </div>
        </article>
      </div>

      <section className="mt-3 sui-glass-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <HardDrive className="size-4 text-sky-300" />
            Disk Usage &amp; I/O
          </div>
          <ul className="flex flex-wrap gap-3 text-[11px] text-white/55">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-400" />
              Read
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-violet-400" />
              Write
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              Usage
            </li>
          </ul>
        </div>
        <div className="h-[180px]">
          <DiskIOChart points={chart} />
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="sui-glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
            <HardDrive className="size-4 text-violet-300" />
            Disk Usage by Mount Point
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead className="text-[11px] text-white/40">
                <tr>
                  <th className="pb-2 font-medium">Mount Point</th>
                  <th className="pb-2 font-medium">Usage</th>
                  <th className="pb-2 font-medium">Used / Total</th>
                  <th className="pb-2 text-right font-medium">% Used</th>
                </tr>
              </thead>
              <tbody>
                {mounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-white/40">
                      {online ? "No mount points reported." : "—"}
                    </td>
                  </tr>
                ) : (
                  mounts.map((mount) => (
                    <tr
                      key={`${mount.device}-${mount.mountPoint}`}
                      className="border-t border-white/6"
                    >
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <MountGlyph path={mount.mountPoint} />
                          <span className="font-medium">{mount.mountPoint}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${Math.min(100, mount.usage)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 tabular-nums text-white/70">
                        {formatBytes(mount.usedBytes)} / {formatBytes(mount.totalBytes)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">
                        {Math.round(mount.usage)}%
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
            Disk Details
          </div>
          <dl className="space-y-2 text-[12px]">
            {detailRows(snap, used, free, total).map(([label, value]) => (
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

function MountGlyph({ path }: { path: string }) {
  if (path === "/") {
    return (
      <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
        <Triangle className="size-3 fill-current" />
      </span>
    );
  }
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
      <Folder className="size-3.5" />
    </span>
  );
}

function sortMounts(a: MonitorDiskMount, b: MonitorDiskMount) {
  if (a.mountPoint === "/") return -1;
  if (b.mountPoint === "/") return 1;
  return a.mountPoint.localeCompare(b.mountPoint);
}

function detailRows(
  snap: ServerInfo | null,
  used: number,
  free: number,
  total: number,
): [string, string][] {
  const temp = snap?.diskTempC || 0;
  const tempLabel = !temp ? "—" : `${Math.round(temp)}°C`;
  const tempState = !temp ? "" : temp < 50 ? "Normal" : temp < 70 ? "Warm" : "Hot";
  return [
    ["Device", snap?.diskDevice || "—"],
    ["Model", snap?.diskModel || "—"],
    ["Type", snap?.diskType || "—"],
    ["Total Capacity", total ? formatBytes(total) : "—"],
    ["Used Space", `${formatBytes(used)} (${formatPercent(used, total)})`],
    ["Free Space", `${formatBytes(free)} (${formatPercent(free, total)})`],
    ["File System", snap?.diskFSType || "—"],
    ["Mount Options", snap?.diskMountOptions || "—"],
    ["Read Speed (Current)", formatRate(snap?.diskReadBps || 0)],
    ["Write Speed (Current)", formatRate(snap?.diskWriteBps || 0)],
    ["IOPS (Read)", formatCount(Math.round(snap?.diskReadIops || 0))],
    ["IOPS (Write)", formatCount(Math.round(snap?.diskWriteIops || 0))],
    ["Temperature", tempState ? `${tempLabel}  ${tempState}` : tempLabel],
  ];
}

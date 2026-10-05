export type HistoryPoint = {
  t: number;
  cpu: number;
  cpuUser: number;
  cpuSystem: number;
  cpuIowait: number;
  memory: number;
  memUsedBytes: number;
  memCachedBytes: number;
  memBuffersBytes: number;
  memAvailableBytes: number;
  disk: number;
  diskReadBps: number;
  diskWriteBps: number;
  netRx: number;
  netTx: number;
  svcRunning: number;
  svcStopped: number;
  svcFailed: number;
  svcOther: number;
  cores?: number[];
};

export type ChartKey = Exclude<keyof HistoryPoint, "t" | "cores">;

export function formatPercent(part: number, total: number): string {
  if (!total || !Number.isFinite(part)) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  return Math.round(value).toLocaleString();
}

export function formatGHz(mhz: number): string {
  if (!Number.isFinite(mhz) || mhz <= 0) return "—";
  const ghz = mhz >= 20 ? mhz / 1000 : mhz;
  if (ghz >= 10) return `${ghz.toFixed(0)} GHz`;
  return `${ghz.toFixed(2)} GHz`;
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const scaled = [
    { unit: "TB", size: 1024 ** 4 },
    { unit: "GB", size: 1024 ** 3 },
    { unit: "MB", size: 1024 ** 2 },
    { unit: "KB", size: 1024 },
  ];
  for (const item of scaled) {
    if (bytes >= item.size) {
      const value = bytes / item.size;
      const rounded = value >= 100 ? value.toFixed(0) : value.toFixed(digits);
      return `${rounded} ${item.unit}`;
    }
  }
  return `${Math.round(bytes)} B`;
}

export function formatRate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "0 B/s";
  return `${formatBytes(bps)}/s`;
}

export function formatUptime(seconds: number): string {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} days, ${hours} hours`;
  if (hours > 0) return `${hours} hours, ${minutes} minutes`;
  return `${minutes} minutes`;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mergeHistory(
  prev: HistoryPoint[],
  incoming: HistoryPoint[],
  live: HistoryPoint,
): HistoryPoint[] {
  const base = incoming.length >= prev.length ? incoming : prev;
  const last = base[base.length - 1];
  if (last && Math.abs(last.t - live.t) < 400) {
    return [...base.slice(0, -1), live];
  }
  return [...base, live].slice(-360);
}

export function filterHistory(points: HistoryPoint[], rangeMs: number): HistoryPoint[] {
  if (points.length === 0) return points;
  const cutoff = Date.now() - rangeMs;
  const filtered = points.filter((point) => point.t >= cutoff);
  return filtered.length > 1 ? filtered : points.slice(-2);
}

export function trafficBytes(points: HistoryPoint[], key: "netRx" | "netTx"): number {
  if (points.length < 2) return 0;
  let bytes = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dt = Math.max(0, (points[i].t - points[i - 1].t) / 1000);
    bytes += Number(points[i][key] || 0) * dt;
  }
  return bytes;
}

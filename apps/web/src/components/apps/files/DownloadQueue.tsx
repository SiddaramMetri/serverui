"use client";

import { useCallback, useRef, useState } from "react";
import { downloadUrl, type FileEntry } from "@/src/lib/api/files";
import { formatSize } from "@/src/lib/files/format";
import { toolbarClass } from "@/src/components/apps/files/FileToolbar";

// ponytail: files are buffered in memory to report progress; above this size the browser's own
// download manager takes over (no in-app progress). Stream to disk via the File System Access API
// if large in-app downloads become a need.
const IN_APP_LIMIT = 512 * 1024 * 1024;

export type DownloadState = "pending" | "active" | "done" | "failed" | "browser";

export type DownloadItem = {
  path: string;
  name: string;
  size: number;
  state: DownloadState;
  loaded: number;
  error?: string;
};

function saveHref(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function fetchWithProgress(url: string, onProgress: (loaded: number) => void) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `download failed (${response.status})`);
  }
  if (!response.body) return response.blob();
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded);
  }
  return new Blob(chunks, { type: response.headers.get("Content-Type") || undefined });
}

export function useDownloadQueue(serverId: string) {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const running = useRef(false);
  const queue = useRef<DownloadItem[]>([]);

  const patch = useCallback((path: string, next: Partial<DownloadItem>) => {
    setItems((prev) => prev.map((item) => (item.path === path ? { ...item, ...next } : item)));
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length > 0) {
      const item = queue.current.shift()!;
      const url = downloadUrl(serverId, item.path);
      if (item.size > IN_APP_LIMIT) {
        saveHref(url, item.name);
        patch(item.path, { state: "browser" });
        continue;
      }
      patch(item.path, { state: "active", loaded: 0, error: undefined });
      try {
        const blob = await fetchWithProgress(url, (loaded) => patch(item.path, { loaded }));
        const href = URL.createObjectURL(blob);
        saveHref(href, item.name);
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        patch(item.path, { state: "done", loaded: blob.size });
      } catch (err) {
        patch(item.path, {
          state: "failed",
          error: err instanceof Error ? err.message : "download failed",
        });
      }
    }
    running.current = false;
  }, [patch, serverId]);

  const start = useCallback(
    (files: FileEntry[]) => {
      const fresh = files.map<DownloadItem>((file) => ({
        path: file.path,
        name: file.name,
        size: file.size,
        state: "pending",
        loaded: 0,
      }));
      setItems((prev) => [
        ...prev.filter((item) => !fresh.some((f) => f.path === item.path)),
        ...fresh,
      ]);
      queue.current.push(...fresh);
      void run();
    },
    [run],
  );

  // Only failed items are queued again; completed downloads are never restarted.
  const retryFailed = useCallback(() => {
    const failed = items.filter((item) => item.state === "failed");
    for (const item of failed) patch(item.path, { state: "pending", error: undefined });
    queue.current.push(...failed);
    void run();
  }, [items, patch, run]);

  const dismiss = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.state === "active" || item.state === "pending"));
  }, []);

  return { items, start, retryFailed, dismiss };
}

export function DownloadPanel({
  items,
  onRetry,
  onDismiss,
}: {
  items: DownloadItem[];
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (items.length === 0) return null;
  const done = items.filter((item) => item.state === "done" || item.state === "browser").length;
  const failed = items.filter((item) => item.state === "failed").length;
  const busy = items.some((item) => item.state === "active" || item.state === "pending");

  return (
    <div
      className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-[12px] text-sky-900 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-200"
      role="status"
      aria-label="Downloads"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-medium">
          {busy ? "Downloading" : "Downloads"}: {done} of {items.length} complete
          {failed > 0 ? `, ${failed} failed` : ""}
        </span>
        {failed > 0 && !busy ? (
          <button type="button" className={toolbarClass} onClick={onRetry}>
            Retry failed
          </button>
        ) : null}
        {!busy ? (
          <button type="button" className={toolbarClass} onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
      <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const pct =
            item.size > 0 ? Math.min(100, Math.round((item.loaded / item.size) * 100)) : 0;
          return (
            <li key={item.path} className="flex items-center gap-2">
              <span className="w-40 min-w-0 truncate" title={item.path}>
                {item.name}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sky-200/70 dark:bg-sky-900/60">
                <span
                  className={`block h-full ${item.state === "failed" ? "bg-red-500" : "bg-sky-500"}`}
                  style={{
                    width: `${item.state === "done" || item.state === "browser" ? 100 : pct}%`,
                  }}
                />
              </span>
              <span
                className={`w-44 shrink-0 truncate text-right ${item.state === "failed" ? "text-red-700 dark:text-red-300" : ""}`}
                title={item.error}
              >
                {item.state === "pending" && "Waiting"}
                {item.state === "active" && `${formatSize(item.loaded)} / ${formatSize(item.size)}`}
                {item.state === "done" && "Done"}
                {item.state === "browser" && "Sent to browser downloads"}
                {item.state === "failed" && `Failed: ${item.error}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

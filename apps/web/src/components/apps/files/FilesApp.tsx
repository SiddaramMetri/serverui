"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ApiError } from "@/src/lib/api/client";
import {
  archiveStem,
  baseName,
  buildMoveDestination,
  cancelExtract,
  createDirectory,
  createFile,
  deleteFile,
  downloadUrl,
  getExtractJob,
  isExtractFinished,
  isExtractable,
  isValidMove,
  joinPath,
  listFiles,
  parentPath,
  renameFile,
  resolveExtract,
  startExtract,
  suggestUniqueName,
  uploadFile,
  type ConflictPolicy,
  type ExtractJob,
  type FileEntry,
} from "@/src/lib/api/files";
import { useWindowManager } from "@/src/components/window/window-context";
import { useServer } from "@/src/lib/api/server-context";
import { useSelectedServer } from "@/src/lib/session";
import { formatSize, totalSize } from "@/src/lib/files/format";
import { Breadcrumbs } from "@/src/components/apps/files/Breadcrumbs";
import { FileContextMenu } from "@/src/components/apps/files/FileContextMenu";
import { FileGrid } from "@/src/components/apps/files/FileGrid";
import { FileList } from "@/src/components/apps/files/FileList";
import { FileToolbar, type FilesView } from "@/src/components/apps/files/FileToolbar";
import { FilesSidebar } from "@/src/components/apps/files/FilesSidebar";

type Dialog =
  | { type: "file"; value: string }
  | { type: "dir"; value: string }
  | { type: "rename"; value: string; from: string }
  | { type: "extract"; value: string; archive: FileEntry };

/** Small text buttons in the Files sheets and banners. */
const toolbarClass =
  "sui-hover inline-flex items-center gap-1 rounded-md px-2 py-1 sui-muted outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40";

const DIALOG_TEXT: Record<Dialog["type"], { label: string; submit: string }> = {
  dir: { label: "Folder name", submit: "Create" },
  file: { label: "File name", submit: "Create" },
  rename: { label: "Rename", submit: "Rename" },
  extract: { label: "Extract to", submit: "Extract" },
};

const EXTRACT_POLL_MS = 750;
const HOME_PATH = "~";
const VIEW_STORAGE_KEY = "serverui-files-view";

function readStoredView(): FilesView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "icons";
  } catch {
    return "icons";
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MenuState = {
  x: number;
  y: number;
  entry: FileEntry | null;
};

type PendingMove = {
  from: string;
  to: string;
  destDir: string;
  name: string;
  destNames: string[];
};

export function FilesApp() {
  const { openWindow } = useWindowManager();
  const { server } = useServer();
  const selectedServer = useSelectedServer();
  const [path, setPath] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileEntry[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  // The job as started; ExtractStatus owns its live progress so polling only
  // re-renders the banner, not every row of the folder.
  const [extractJob, setExtractJob] = useState<ExtractJob | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  const [view, setView] = useState<FilesView>(readStoredView);
  const uploadRef = useRef<HTMLInputElement>(null);
  // The folder on screen, read when a background extraction finishes.
  const pathRef = useRef(path);
  const serverId = selectedServer?.id || "";
  // The server resolves "~" to the user's real home (e.g. /root for root);
  // remember it so the sidebar can highlight Home.
  const [homeDir, setHomeDir] = useState<string | null>(null);

  async function load(nextPath: string) {
    if (!serverId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listFiles(serverId, nextPath);
      if (nextPath === HOME_PATH) setHomeDir(result.path);
      const sorted = [...result.entries].sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setPath(result.path || nextPath);
    } catch (err) {
      setEntries([]);
      setError(err instanceof ApiError ? err.message : "unable to list files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    listFiles(serverId, "/")
      .then((result) => {
        if (cancelled) return;
        const sorted = [...result.entries].sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setEntries(sorted);
        setPath(result.path || "/");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setEntries([]);
        setError(err instanceof ApiError ? err.message : "unable to list files");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  function goTo(next: string) {
    const normalized = next.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    const nextHistory = [...history.slice(0, historyIndex + 1), normalized];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    clearSelection();
    setQuery("");
    setPath(normalized);
    setMenu(null);
    setDownloadStatus(null);
    setPendingMove(null);
    void load(normalized);
  }

  function back() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    clearSelection();
    setPath(history[nextIndex]);
    setDownloadStatus(null);
    void load(history[nextIndex]);
  }

  function forward() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    clearSelection();
    setPath(history[nextIndex]);
    setDownloadStatus(null);
    void load(history[nextIndex]);
  }

  function openEntry(entry: FileEntry) {
    if (entry.type === "dir") {
      goTo(entry.path);
      return;
    }
    openWindow("viewer", {
      filePath: entry.path,
      fileName: entry.name,
      fileSize: entry.size,
      modified: entry.modified,
      mime: entry.mime,
    });
  }

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => selectedPaths.has(entry.path));
  }, [entries, selectedPaths]);

  const singleSelectedEntry = selectedEntries.length === 1 ? selectedEntries[0] : null;
  const selectedTotalSize = useMemo(() => totalSize(selectedEntries), [selectedEntries]);

  function openSelected() {
    if (singleSelectedEntry) {
      openEntry(singleSelectedEntry);
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [entries, query]);

  function selectSingle(targetPath: string) {
    setSelectedPaths(new Set([targetPath]));
    setLastSelectedPath(targetPath);
  }

  function toggleSelect(targetPath: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(targetPath)) {
        next.delete(targetPath);
      } else {
        next.add(targetPath);
      }
      return next;
    });
    setLastSelectedPath(targetPath);
  }

  function selectRange(targetPath: string) {
    const targetIndex = visible.findIndex((e) => e.path === targetPath);
    if (targetIndex === -1) return;

    const lastIndex = lastSelectedPath ? visible.findIndex((e) => e.path === lastSelectedPath) : -1;

    if (lastIndex === -1) {
      setSelectedPaths(new Set([targetPath]));
      setLastSelectedPath(targetPath);
      return;
    }

    const start = Math.min(lastIndex, targetIndex);
    const end = Math.max(lastIndex, targetIndex);
    const rangePaths = visible.slice(start, end + 1).map((e) => e.path);

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of rangePaths) {
        next.add(p);
      }
      return next;
    });
    setLastSelectedPath(targetPath);
  }

  function selectAll() {
    setSelectedPaths(new Set(visible.map((e) => e.path)));
  }

  function clearSelection() {
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
  }

  function handleSelectionChange(paths: Set<string>) {
    setSelectedPaths(paths);
    if (paths.size > 0) {
      const last = visible.filter((e) => paths.has(e.path)).pop();
      if (last) setLastSelectedPath(last.path);
    }
  }

  function handleRowSelect(targetPath: string, event?: MouseEvent) {
    if (event?.shiftKey) {
      selectRange(targetPath);
    } else if (event?.ctrlKey || event?.metaKey) {
      toggleSelect(targetPath);
    } else {
      selectSingle(targetPath);
    }
  }

  async function submitDialog() {
    if (!dialog || !dialog.value.trim()) return;
    const name = dialog.value.trim();
    if (dialog.type === "extract") {
      const destination = name.startsWith("/") ? name : joinPath(path, name);
      setDialog(null);
      await onExtract(dialog.archive, "to", destination);
      return;
    }
    try {
      if (dialog.type === "file") {
        await createFile(serverId, joinPath(path, name));
      } else if (dialog.type === "dir") {
        await createDirectory(serverId, joinPath(path, name));
      } else if (dialog.type === "rename") {
        await renameFile(serverId, dialog.from, joinPath(parentPath(dialog.from), name));
      }
      setDialog(null);
      await load(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "filesystem operation failed");
    }
  }

  async function onDelete(items: FileEntry[]) {
    if (!items || items.length === 0) return;
    setIsDeleting(true);
    setError(null);
    const errors: string[] = [];
    const successfulPaths = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setDeletingProgress({ current: i + 1, total: items.length, name: item.name });
      try {
        await deleteFile(serverId, item.path);
        successfulPaths.add(item.path);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "operation failed";
        errors.push(`“${item.name}”: ${msg}`);
      }
    }

    setIsDeleting(false);
    setPendingDelete(null);
    setDeletingProgress(null);

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of successfulPaths) {
        next.delete(p);
      }
      return next;
    });

    if (errors.length > 0) {
      if (successfulPaths.size > 0) {
        setError(
          `Deleted ${successfulPaths.size} of ${items.length} items. Failed to delete: ${errors.join(", ")}`,
        );
      } else {
        setError(`Failed to delete: ${errors.join(", ")}`);
      }
    }

    await load(path);
  }

  async function onDownloadSelected(itemsToDownload: FileEntry[]) {
    if (!itemsToDownload || itemsToDownload.length === 0) return;

    const files = itemsToDownload.filter((e) => e.type === "file");
    const dirs = itemsToDownload.filter((e) => e.type === "dir");

    if (files.length === 0 && dirs.length > 0) {
      setDownloadStatus({
        type: "error",
        message:
          dirs.length === 1
            ? `Folder “${dirs[0].name}” cannot be downloaded directly with the current download architecture.`
            : `Folders cannot be downloaded directly with the current download architecture (${dirs.length} folders selected).`,
      });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setDownloadStatus({
        type: "info",
        message:
          files.length > 1
            ? `Downloading ${i + 1} of ${files.length}: “${file.name}”…`
            : `Downloading “${file.name}”…`,
      });

      const url = downloadUrl(serverId, file.path);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (i < files.length - 1) {
        await wait(350);
      }
    }

    const skippedText =
      dirs.length > 0
        ? ` (${dirs.length} ${dirs.length === 1 ? "folder" : "folders"} skipped: folders cannot be downloaded directly)`
        : "";

    setDownloadStatus({
      type: "success",
      message: `Downloaded ${files.length} ${files.length === 1 ? "file" : "files"}${skippedText}.`,
    });

    setTimeout(() => {
      setDownloadStatus((current) => (current?.type === "success" ? null : current));
    }, 4000);
  }

  async function onUpload(fileList: globalThis.FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    try {
      await uploadFile(serverId, path, file);
      await load(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "upload failed");
    }
  }

  async function handleMove(sourcePath: string, destDir: string, sourceType?: "file" | "dir") {
    const source = entries.find((entry) => entry.path === sourcePath);
    const type = source?.type ?? sourceType ?? "file";
    const name = source?.name ?? baseName(sourcePath);
    if (!isValidMove(sourcePath, type, destDir)) {
      setError("cannot move an item into itself or its current location");
      return;
    }
    const to = buildMoveDestination(destDir, sourcePath);
    if (sourcePath === to) return;
    try {
      setError(null);
      const destEntries = destDir === path ? entries : (await listFiles(serverId, destDir)).entries;
      if (destEntries.some((entry) => entry.name === name && entry.path !== sourcePath)) {
        setPendingMove({
          from: sourcePath,
          to,
          destDir,
          name,
          destNames: destEntries.map((entry) => entry.name),
        });
        return;
      }
      await renameFile(serverId, sourcePath, to);
      clearSelection();
      await load(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `unable to move ${baseName(sourcePath)}`);
    }
  }

  async function resolveMove(mode: "replace" | "rename") {
    if (!pendingMove) return;
    try {
      setError(null);
      const to =
        mode === "replace"
          ? pendingMove.to
          : joinPath(
              pendingMove.destDir,
              suggestUniqueName(pendingMove.destNames, pendingMove.name),
            );
      await renameFile(serverId, pendingMove.from, to);
      setPendingMove(null);
      clearSelection();
      await load(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `unable to move ${pendingMove.name}`);
    }
  }

  async function onExtract(entry: FileEntry, mode: "here" | "to", destination?: string) {
    setError(null);
    try {
      const job = await startExtract(serverId, entry.path, mode, destination);
      setExtractJob(job);
      setExtractBusy(!isExtractFinished(job.state));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `unable to extract ${entry.name}`);
    }
  }

  async function showExtracted(job: ExtractJob) {
    const here = pathRef.current;
    const prefix = here === "/" ? "/" : `${here}/`;
    if (job.destination !== here && !job.destination.startsWith(prefix)) return;
    await load(here);
    const inView = job.extracted.filter((item) => parentPath(item) === here);
    if (inView.length > 0) {
      setSelectedPaths(new Set(inView));
      setLastSelectedPath(inView[inView.length - 1]);
    }
  }

  function onExtractFinished(job: ExtractJob) {
    setExtractBusy(false);
    if (job.state === "done") void showExtracted(job);
  }

  function changeView(next: FilesView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // The view is a per-viewer convenience; ignore unavailable storage.
    }
  }

  function openContextMenu(event: MouseEvent, entry: FileEntry | null) {
    event.preventDefault();
    event.stopPropagation();
    if (entry) {
      if (!selectedPaths.has(entry.path)) {
        setSelectedPaths(new Set([entry.path]));
        setLastSelectedPath(entry.path);
      }
    }
    const width = 210;
    const height = 240;
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - width - 8),
      y: Math.min(event.clientY, window.innerHeight - height - 8),
      entry,
    });
  }

  function copyPath(value: string) {
    void navigator.clipboard.writeText(value);
  }

  /** Copies every selected path when several are selected, otherwise `single`. */
  function copySelectionPaths(single: string) {
    copyPath(
      selectedEntries.length > 1 ? selectedEntries.map((entry) => entry.path).join("\n") : single,
    );
  }

  const newFolder = () => setDialog({ type: "dir", value: "" });
  const newFile = () => setDialog({ type: "file", value: "" });
  const pickUpload = () => uploadRef.current?.click();

  function openInfo(entry: FileEntry | null) {
    const target = entry;
    if (!target) return;
    openWindow("viewer", {
      filePath: target.path,
      fileName: target.name,
      fileSize: target.size,
      modified: target.modified,
      mime: target.mime,
      isDirectory: target.type === "dir",
      infoOnly: true,
    });
  }

  function openTerminalHere(entry: FileEntry | null) {
    const cwd = entry?.type === "dir" ? entry.path : path;
    openWindow("terminal", { cwd });
  }

  // One extraction at a time per window; the menu hides Extract while busy.
  const extractTarget =
    menu?.entry?.type === "file" && isExtractable(menu.entry.name) && !extractBusy
      ? menu.entry
      : null;

  const viewProps = {
    path,
    entries: visible,
    selectedPaths,
    onSelect: handleRowSelect,
    onToggleSelect: toggleSelect,
    onSelectRange: selectRange,
    onSelectionChange: handleSelectionChange,
    onClearSelection: clearSelection,
    onOpen: openEntry,
    onContextMenu: openContextMenu,
    onMove: (source: string, dest: string, type: "file" | "dir") =>
      void handleMove(source, dest, type),
  };
  const serverName = selectedServer?.name || server?.hostname || "Server";
  const title = path === "/" ? serverName : baseName(path);
  const statusText =
    selectedEntries.length > 0
      ? `${selectedEntries.length} of ${visible.length} selected${
          selectedTotalSize > 0 ? `, ${formatSize(selectedTotalSize)}` : ""
        }`
      : `${visible.length} ${visible.length === 1 ? "item" : "items"}, ${formatSize(totalSize(visible))}`;

  return (
    <div
      className="sui-finder flex h-full min-h-0 overflow-hidden"
      onClick={() => setMenu(null)}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          selectAll();
        } else if (event.key === "Escape") {
          event.preventDefault();
          clearSelection();
        } else if (event.key === "Delete" || event.key === "Backspace") {
          if (selectedEntries.length > 0) {
            event.preventDefault();
            setPendingDelete(selectedEntries);
          }
        } else if (event.key === "Enter") {
          if (singleSelectedEntry) {
            event.preventDefault();
            openEntry(singleSelectedEntry);
          }
        }
      }}
    >
      <FilesSidebar
        path={path}
        homePath={homeDir ?? HOME_PATH}
        serverName={serverName}
        onNavigate={goTo}
      />
      <div className="bg-[var(--finder-content)] flex min-h-0 min-w-0 flex-1 flex-col">
        <FileToolbar
          title={title}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          onBack={back}
          onForward={forward}
          view={view}
          onViewChange={changeView}
          selectedCount={selectedEntries.length}
          query={query}
          onQueryChange={setQuery}
          onUploadClick={pickUpload}
          onNewFolder={newFolder}
          onNewFile={newFile}
          onOpen={openSelected}
          onDownload={() => void onDownloadSelected(selectedEntries)}
          onRename={() =>
            singleSelectedEntry &&
            setDialog({
              type: "rename",
              value: singleSelectedEntry.name,
              from: singleSelectedEntry.path,
            })
          }
          onDelete={() => selectedEntries.length > 0 && setPendingDelete(selectedEntries)}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onCopyPath={() => copySelectionPaths(path)}
          onTerminalHere={() => openTerminalHere(null)}
        />
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            void onUpload(event.target.files);
            event.target.value = "";
          }}
        />
        {dialog ? (
          <form
            className="sui-finder-sheet flex items-center gap-2 px-4 py-2 text-[12px]"
            onSubmit={(event) => {
              event.preventDefault();
              void submitDialog();
            }}
          >
            <label className="sui-finder-muted">{DIALOG_TEXT[dialog.type].label}</label>
            <input
              autoFocus
              className="sui-input min-w-0 flex-1 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-sky-400"
              value={dialog.value}
              onChange={(event) => setDialog({ ...dialog, value: event.target.value })}
            />
            <button type="submit" className={toolbarClass}>
              {DIALOG_TEXT[dialog.type].submit}
            </button>
            <button type="button" className={toolbarClass} onClick={() => setDialog(null)}>
              Cancel
            </button>
          </form>
        ) : null}
        {downloadStatus ? (
          <StatusBanner
            tone={downloadStatus.type}
            message={downloadStatus.message}
            onDismiss={() => setDownloadStatus(null)}
          />
        ) : null}
        {extractJob ? (
          <ExtractStatus
            key={extractJob.id}
            serverId={serverId}
            initial={extractJob}
            onFinished={onExtractFinished}
            onError={setError}
            onDismiss={() => {
              setExtractJob(null);
              setExtractBusy(false);
            }}
          />
        ) : null}
        {error ? (
          <p
            className="border-b border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {pendingDelete && pendingDelete.length > 0 ? (
          <div
            className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px] ${BANNER_TONES.warning}`}
            role="alertdialog"
            aria-labelledby="delete-file-title"
          >
            <p id="delete-file-title" className="min-w-0 flex-1">
              {isDeleting ? (
                <span>
                  Deleting {deletingProgress?.current || 1} of {pendingDelete.length}
                  {deletingProgress?.name ? `: “${deletingProgress.name}”` : "…"}
                </span>
              ) : pendingDelete.length === 1 ? (
                <>
                  Delete{" "}
                  <span className="font-medium">
                    {pendingDelete[0].type === "dir" ? "folder" : "file"} “{pendingDelete[0].name}”
                  </span>
                  ? This cannot be undone on the remote server.
                </>
              ) : (
                <>
                  Delete <span className="font-medium">{pendingDelete.length} items</span>? This
                  action cannot be undone.
                </>
              )}
            </p>
            <button
              type="button"
              className={toolbarClass}
              disabled={isDeleting}
              onClick={() => {
                setPendingDelete(null);
                setDeletingProgress(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              onClick={() => void onDelete(pendingDelete)}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        ) : null}
        {pendingMove ? (
          <div
            className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px] ${BANNER_TONES.warning}`}
            role="alertdialog"
            aria-labelledby="move-conflict-title"
          >
            <p id="move-conflict-title" className="min-w-0 flex-1">
              An item named <span className="font-medium">“{pendingMove.name}”</span> already
              exists.
            </p>
            <button type="button" className={toolbarClass} onClick={() => setPendingMove(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={toolbarClass}
              onClick={() => void resolveMove("replace")}
            >
              Replace
            </button>
            <button
              type="button"
              className={toolbarClass}
              onClick={() => void resolveMove("rename")}
            >
              Rename
            </button>
          </div>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {view === "icons" ? (
            <FileGrid {...viewProps} />
          ) : (
            <FileList {...viewProps} onParent={() => path !== "/" && goTo(parentPath(path))} />
          )}
          {!loading && !error && visible.length === 0 ? (
            <p className="sui-finder-muted pointer-events-none absolute inset-x-0 top-1/3 text-center text-[13px]">
              {query.trim() ? `No items match “${query.trim()}”` : "This folder is empty"}
            </p>
          ) : null}
          {loading ? (
            <div className="sui-finder-muted pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--finder-content)]/60 text-[13px]">
              Loading files…
            </div>
          ) : null}
        </div>
        <div className="border-t border-[var(--finder-hairline)] bg-[var(--finder-toolbar)] flex h-[28px] shrink-0 items-center gap-3 px-3 text-[11.5px]">
          <Breadcrumbs path={path} rootLabel={serverName} onNavigate={goTo} />
          <span className="sui-finder-muted shrink-0">{statusText}</span>
        </div>
      </div>
      {menu ? (
        <FileContextMenu
          x={menu.x}
          y={menu.y}
          entry={menu.entry}
          selectedEntries={selectedEntries}
          onOpen={() => {
            if (menu.entry) openEntry(menu.entry);
            else goTo(path);
          }}
          onDownload={() => {
            if (selectedEntries.length > 1) {
              void onDownloadSelected(selectedEntries);
            } else if (menu.entry) {
              void onDownloadSelected([menu.entry]);
            }
          }}
          onExtractHere={extractTarget ? () => void onExtract(extractTarget, "here") : undefined}
          onExtractTo={
            extractTarget
              ? () =>
                  setDialog({
                    type: "extract",
                    value: joinPath(path, archiveStem(extractTarget.name)),
                    archive: extractTarget,
                  })
              : undefined
          }
          onDelete={() => {
            if (selectedEntries.length > 0) {
              setPendingDelete(selectedEntries);
            } else if (menu.entry) {
              setPendingDelete([menu.entry]);
            }
          }}
          onCopyPath={() => copySelectionPaths(menu.entry?.path || path)}
          onInfo={() => openInfo(menu.entry)}
          onTerminalHere={() => openTerminalHere(menu.entry)}
          onNewFolder={newFolder}
          onNewFile={newFile}
          onUpload={pickUpload}
          onClearSelection={clearSelection}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

/** Live extraction banner: polls its job and owns the conflict / cancel actions. */
function ExtractStatus({
  serverId,
  initial,
  onFinished,
  onError,
  onDismiss,
}: {
  serverId: string;
  initial: ExtractJob;
  onFinished: (job: ExtractJob) => void;
  onError: (message: string) => void;
  onDismiss: () => void;
}) {
  const [job, setJob] = useState(initial);
  // A cancel finishes asynchronously, so keep polling past a pending decision.
  const [cancelling, setCancelling] = useState(false);
  const onFinishedRef = useRef(onFinished);
  const name = baseName(job.archive);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    if (isExtractFinished(job.state)) return;
    if (job.state === "awaiting_decision" && !cancelling) return;
    let stopped = false;
    const timer = window.setTimeout(async () => {
      let next: ExtractJob;
      try {
        next = await getExtractJob(serverId, job.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          if (!stopped) setJob((current) => ({ ...current })); // retry next tick
          return;
        }
        next = { ...job, state: "failed", error: "extraction status is no longer available" };
      }
      if (stopped) return;
      setJob(next);
      if (isExtractFinished(next.state)) onFinishedRef.current(next);
    }, EXTRACT_POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [job, cancelling, serverId]);

  async function onResolve(policy: ConflictPolicy) {
    try {
      setJob(await resolveExtract(serverId, job.id, policy));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "unable to continue extraction");
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      setJob(await cancelExtract(serverId, job.id));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "unable to cancel extraction");
    }
  }

  if (job.state === "awaiting_decision" && !cancelling) {
    const shown = job.conflicts.slice(0, 3).map((item) => `“${item}”`);
    const more = job.conflicts.length - shown.length;
    return (
      <div
        className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px] ${BANNER_TONES.warning}`}
        role="alertdialog"
        aria-labelledby="extract-conflict-title"
      >
        <p id="extract-conflict-title" className="min-w-0 flex-1">
          {job.conflicts.length === 1 ? (
            <>
              <span className="font-medium">{shown[0]}</span> already exists in {job.destination}.
            </>
          ) : (
            <>
              <span className="font-medium">{job.conflicts.length} items</span> already exist in{" "}
              {job.destination}: {shown.join(", ")}
              {more > 0 ? ` and ${more} more` : ""}.
            </>
          )}
        </p>
        <button type="button" className={toolbarClass} onClick={() => void onCancel()}>
          Cancel
        </button>
        <button type="button" className={toolbarClass} onClick={() => void onResolve("keep-both")}>
          Keep both
        </button>
        <button
          type="button"
          className="rounded-md bg-red-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-700"
          onClick={() => void onResolve("replace")}
        >
          Replace
        </button>
      </div>
    );
  }

  if (!isExtractFinished(job.state)) {
    const percent = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
    return (
      <div
        className={`flex items-center gap-3 border-b px-4 py-2 text-[12px] ${BANNER_TONES.info}`}
        role="status"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate">
            {cancelling
              ? `Cancelling “${name}”…`
              : job.state === "scanning"
                ? `Checking “${name}”…`
                : `Extracting “${name}”… ${job.done} of ${job.total} (${percent}%)`}
          </p>
          {job.state === "extracting" ? (
            <div
              className="mt-1 h-1 overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900"
              role="progressbar"
              aria-label="Extraction progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full bg-sky-500 transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={toolbarClass}
          disabled={cancelling}
          onClick={() => void onCancel()}
        >
          Cancel
        </button>
      </div>
    );
  }

  const message =
    job.state === "done"
      ? job.extracted.length === 1
        ? `Extracted “${name}” to ${job.extracted[0]}.`
        : `Extracted “${name}” into ${job.destination}.`
      : job.state === "failed"
        ? `Couldn’t extract “${name}”: ${job.error || "extraction failed"}.`
        : `Extraction of “${name}” was cancelled. Nothing was changed.`;
  return (
    <StatusBanner
      tone={job.state === "done" ? "success" : job.state === "failed" ? "error" : "neutral"}
      message={message}
      onDismiss={onDismiss}
    />
  );
}

const BANNER_TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300",
  neutral:
    "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200",
};

function StatusBanner({
  tone,
  message,
  onDismiss,
}: {
  tone: Exclude<keyof typeof BANNER_TONES, "warning">;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b px-4 py-2 text-[12px] ${BANNER_TONES[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        className="ml-2 text-xs font-semibold opacity-70 hover:opacity-100"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

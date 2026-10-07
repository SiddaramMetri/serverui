import { apiRequest } from "@/src/lib/api/client";
import { authenticatedApiUrl } from "@/src/lib/runtime";

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  mode: string;
  modified: string;
  mime?: string;
};

export type FileList = {
  path: string;
  entries: FileEntry[];
};

export type FileContent = {
  path: string;
  content: string;
  size?: number;
  truncated?: boolean;
  mime?: string;
  binary?: boolean;
};

function fileQuery(serverId: string, extra: Record<string, string>) {
  return new URLSearchParams({ serverId, ...extra }).toString();
}

export function listFiles(serverId: string, path: string) {
  return apiRequest<FileList>(`/api/files?${fileQuery(serverId, { path })}`);
}

export function readFile(serverId: string, path: string) {
  return apiRequest<FileContent>(`/api/files/read?${fileQuery(serverId, { path })}`);
}

export function writeFile(serverId: string, path: string, content: string) {
  return apiRequest<{ status: string }>("/api/files/write", {
    method: "POST",
    body: JSON.stringify({ serverId, path, content }),
  });
}

export function createFile(serverId: string, path: string) {
  return apiRequest<{ status: string }>("/api/files/create", {
    method: "POST",
    body: JSON.stringify({ serverId, path }),
  });
}

export function createDirectory(serverId: string, path: string) {
  return apiRequest<{ status: string }>("/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ serverId, path }),
  });
}

export function renameFile(serverId: string, from: string, to: string) {
  return apiRequest<{ status: string }>("/api/files/rename", {
    method: "POST",
    body: JSON.stringify({ serverId, from, to }),
  });
}

export function deleteFile(serverId: string, path: string) {
  return apiRequest<{ status: string }>(`/api/files?${fileQuery(serverId, { path })}`, {
    method: "DELETE",
  });
}

export async function uploadFile(serverId: string, directory: string, file: File) {
  const body = new FormData();
  body.set("serverId", serverId);
  body.set("path", directory);
  body.set("file", file);
  return apiRequest<{ status: string; path: string }>("/api/files/upload", {
    method: "POST",
    body,
  });
}

export type ExtractState =
  "scanning" | "awaiting_decision" | "extracting" | "done" | "failed" | "cancelled";

export type ExtractJob = {
  id: string;
  state: ExtractState;
  archive: string;
  destination: string;
  done: number;
  total: number;
  conflicts: string[];
  extracted: string[];
  error?: string;
};

export type ConflictPolicy = "replace" | "keep-both";

// Longest suffixes first so ".tar.gz" wins; mirrors the server's archive.Detect.
const EXTRACTABLE_SUFFIXES = [
  ".tar.gz",
  ".tar.bz2",
  ".tar.xz",
  ".tgz",
  ".tbz2",
  ".tbz",
  ".txz",
  ".tar",
  ".zip",
  ".7z",
];

export function extractableSuffix(name: string) {
  const lower = name.toLowerCase();
  return EXTRACTABLE_SUFFIXES.find(
    (suffix) => lower.endsWith(suffix) && lower.length > suffix.length,
  );
}

export function isExtractable(name: string) {
  return extractableSuffix(name) !== undefined;
}

/** "backup.tar.gz" → "backup" */
export function archiveStem(name: string) {
  const suffix = extractableSuffix(name);
  return suffix ? name.slice(0, -suffix.length) : name;
}

export function isExtractFinished(state: ExtractState) {
  return state === "done" || state === "failed" || state === "cancelled";
}

export function startExtract(
  serverId: string,
  path: string,
  mode: "here" | "to",
  destination?: string,
) {
  return apiRequest<ExtractJob>("/api/files/extract", {
    method: "POST",
    body: JSON.stringify({ serverId, path, mode, destination }),
  });
}

export function getExtractJob(serverId: string, jobId: string) {
  return apiRequest<ExtractJob>(
    `/api/files/extract/${encodeURIComponent(jobId)}?${fileQuery(serverId, {})}`,
  );
}

export function resolveExtract(serverId: string, jobId: string, policy: ConflictPolicy) {
  return apiRequest<ExtractJob>(`/api/files/extract/${encodeURIComponent(jobId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ serverId, policy }),
  });
}

export function cancelExtract(serverId: string, jobId: string) {
  return apiRequest<ExtractJob>(
    `/api/files/extract/${encodeURIComponent(jobId)}?${fileQuery(serverId, {})}`,
    { method: "DELETE" },
  );
}

export function downloadUrl(serverId: string, path: string) {
  return authenticatedApiUrl(`/api/files/download?${fileQuery(serverId, { path, download: "1" })}`);
}

export function mediaUrl(serverId: string, path: string) {
  return authenticatedApiUrl(`/api/files/download?${fileQuery(serverId, { path })}`);
}

export function joinPath(base: string, name: string) {
  if (base === "/") return `/${name}`;
  return `${base.replace(/\/$/, "")}/${name}`;
}

export function parentPath(path: string) {
  if (path === "/") return "/";
  const trimmed = path.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index <= 0 ? "/" : trimmed.slice(0, index);
}

export function baseName(path: string) {
  const trimmed = path.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index < 0 ? trimmed : trimmed.slice(index + 1);
}

export function buildMoveDestination(destDir: string, sourcePath: string) {
  return joinPath(destDir, baseName(sourcePath));
}

export function isValidMove(sourcePath: string, sourceType: "file" | "dir", destDir: string) {
  if (sourcePath === "/") return false;
  const source = sourcePath.replace(/\/+$/, "") || "/";
  const dest = destDir.replace(/\/+$/, "") || "/";
  if (source === dest) return false;
  if (parentPath(source) === dest) return false;
  // ponytail: prefix check blocks self/descendant drops; backend rename is final guard
  if (sourceType === "dir" && (dest === source || dest.startsWith(`${source}/`))) return false;
  return true;
}

export function suggestUniqueName(existing: string[], desired: string) {
  if (!existing.includes(desired)) return desired;
  const dot = desired.lastIndexOf(".");
  const base = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : "";
  let i = 1;
  while (true) {
    const candidate = `${base} (${i})${ext}`;
    if (!existing.includes(candidate)) return candidate;
    i += 1;
  }
}

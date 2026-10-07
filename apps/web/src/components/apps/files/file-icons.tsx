"use client";

import { fileExtension, getFileType, type FileType } from "@/src/lib/files/file-type";
import { extractableSuffix, type FileEntry } from "@/src/lib/api/files";

type IconEntry = Pick<FileEntry, "name" | "type" | "mime">;

/** Finder-style icon for a file or folder, drawn in SVG so it scales cleanly. */
export function FinderIcon({ entry, size }: { entry: IconEntry; size: number }) {
  if (entry.type === "dir") return <FolderIcon size={size} />;
  return <DocumentIcon entry={entry} size={size} />;
}

export function FolderIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={iconShadow(size)}>
      <path
        d="M5 15a4 4 0 0 1 4-4h14.6a4 4 0 0 1 2.9 1.2l3.3 3.4a4 4 0 0 0 2.9 1.2H55a4 4 0 0 1 4 4V50a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"
        fill="#3b95e4"
      />
      <path
        d="M5 24.5a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4V50a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"
        fill="#76bff7"
      />
      <path d="M9 21.2h46" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" />
    </svg>
  );
}

// Flat fills and no per-icon <defs> keep large folders cheap to render; the
// shadow is only worth its filter cost at icon-view sizes.
function iconShadow(size: number) {
  return size >= 32 ? "shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.14)]" : "shrink-0";
}

const BADGE: Record<FileType, { color: string; label?: string }> = {
  archive: { color: "#8e8e93" },
  image: { color: "#34c759" },
  video: { color: "#af52de" },
  audio: { color: "#ff2d55" },
  pdf: { color: "#ff3b30", label: "PDF" },
  code: { color: "#5856d6" },
  text: { color: "#8e8e93" },
  document: { color: "#0a84ff" },
  unknown: { color: "#8e8e93" },
};

function extensionLabel(name: string) {
  return fileExtension(name).slice(0, 4).toUpperCase();
}

function DocumentIcon({ entry, size }: { entry: IconEntry; size: number }) {
  const kind = getFileType({ name: entry.name, mime: entry.mime });
  const badge = BADGE[kind];
  const label = badge.label ?? extensionLabel(entry.name);
  const small = size < 32;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={iconShadow(size)}>
      <path
        d="M15 5h23.5L51 17.5V57a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        fill="#ffffff"
        stroke="#c9c9ce"
        strokeWidth="1"
      />
      <path
        d="M38.5 5v10.5a2 2 0 0 0 2 2H51"
        fill="#f2f2f5"
        stroke="#c9c9ce"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <DocumentGlyph kind={kind} color={badge.color} />
      {label && !small ? (
        <>
          <rect x="17" y="44" width="30" height="10" rx="2.5" fill={badge.color} />
          <text
            x="32"
            y="51.6"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
            letterSpacing="0.3"
          >
            {label}
          </text>
        </>
      ) : null}
    </svg>
  );
}

function DocumentGlyph({ kind, color }: { kind: FileType; color: string }) {
  switch (kind) {
    case "archive":
      // Zipper down the middle of the page.
      return (
        <g fill={color}>
          {[10, 15, 20, 25, 30, 35].map((y, i) => (
            <rect key={y} x={i % 2 ? 32 : 29} y={y} width="3" height="3" rx="0.6" />
          ))}
          <rect x="28.5" y="38" width="7" height="4" rx="1" />
        </g>
      );
    case "image":
      return (
        <g>
          <rect x="19" y="14" width="26" height="22" rx="2" fill="#e8f6ec" />
          <circle cx="37" cy="20.5" r="3" fill="#ffcc00" />
          <path d="M19 33l8-9 6 6 4-4 8 8v0a2 2 0 0 1-2 2H21a2 2 0 0 1-2-2Z" fill={color} />
        </g>
      );
    case "video":
      return <path d="M27 17v18l15-9Z" fill={color} />;
    case "audio":
      return (
        <path
          d="M37 13v15.5a4.5 4.5 0 1 1-2.5-4V17l-8 2v13.5a4.5 4.5 0 1 1-2.5-4V16.5Z"
          fill={color}
        />
      );
    case "code":
      return (
        <path
          d="M26 18l-7 8 7 8M38 18l7 8-7 8M34.5 15l-5 22"
          fill="none"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    default:
      return (
        <g stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round">
          <path d="M20 16h14M20 21h24M20 26h24M20 31h24M20 36h18" />
        </g>
      );
  }
}

/** Finder's "Kind" column text. */
export function kindLabel(entry: IconEntry) {
  if (entry.type === "dir") return "Folder";
  const ext = extensionLabel(entry.name);
  switch (getFileType({ name: entry.name, mime: entry.mime })) {
    case "archive":
      return archiveKind(entry.name, ext);
    case "image":
      return `${ext} image`;
    case "video":
      return `${ext} video`;
    case "audio":
      return `${ext} audio`;
    case "pdf":
      return "PDF document";
    case "code":
      return `${ext} source`;
    case "text":
      return ext ? `${ext} text` : "Plain text";
    case "document":
      return `${ext} document`;
    default:
      return ext ? `${ext} file` : "Document";
  }
}

function archiveKind(name: string, ext: string) {
  const suffix = extractableSuffix(name) ?? "";
  if (suffix === ".zip") return "ZIP archive";
  if (suffix === ".7z") return "7-Zip archive";
  if (suffix === ".tar") return "Tar archive";
  if (/gz$/.test(suffix)) return "Gzip tar archive";
  if (/bz2?$/.test(suffix)) return "Bzip2 tar archive";
  if (/xz$/.test(suffix)) return "XZ tar archive";
  return `${ext || "Compressed"} archive`;
}

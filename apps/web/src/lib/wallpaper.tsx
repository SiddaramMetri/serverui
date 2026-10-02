"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BuiltInWallpaperId = "crescent" | "valley" | "orbit";
export type WallpaperId = BuiltInWallpaperId | "custom";

export type WallpaperOption = {
  id: BuiltInWallpaperId;
  name: string;
  src: string;
};

export const WALLPAPERS: readonly WallpaperOption[] = [
  {
    id: "crescent",
    name: "Crescent",
    src: "/wallpapers/crescent.png",
  },
  {
    id: "valley",
    name: "Valley",
    src: "/wallpapers/valley.png",
  },
  {
    id: "orbit",
    name: "Orbit",
    src: "/wallpapers/orbit.png",
  },
] as const;

export const DEFAULT_WALLPAPER_ID: BuiltInWallpaperId = "crescent";

const STORAGE_KEY = "serverui-wallpaper";
const CUSTOM_EVENT = "serverui-wallpaper";
const MAX_CUSTOM_BYTES = 8 * 1024 * 1024;
const DB_NAME = "serverui";
const DB_STORE = "prefs";
const CUSTOM_KEY = "wallpaper-custom";

type WallpaperContextValue = {
  wallpaperId: WallpaperId;
  wallpaperSrc: string;
  customSrc: string | null;
  hasCustom: boolean;
  setWallpaper: (id: WallpaperId) => void;
  setCustomWallpaper: (file: File) => Promise<void>;
  clearCustomWallpaper: () => Promise<void>;
};

const WallpaperContext = createContext<WallpaperContextValue | null>(null);

function isWallpaperId(value: string | null): value is WallpaperId {
  return value === "custom" || WALLPAPERS.some((item) => item.id === value);
}

function readStoredId(): WallpaperId {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isWallpaperId(value)) return value;
  } catch {
    // Ignore private-mode storage failures.
  }
  return DEFAULT_WALLPAPER_ID;
}

function writeStoredId(id: WallpaperId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore private-mode storage failures.
  }
  window.dispatchEvent(new Event(CUSTOM_EVENT));
}

function builtInSrc(id: WallpaperId): string {
  if (id === "custom") return WALLPAPERS[0].src;
  return WALLPAPERS.find((item) => item.id === id)?.src ?? WALLPAPERS[0].src;
}

function openPrefsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open wallpaper storage"));
  });
}

async function saveCustomBlob(blob: Blob) {
  const db = await openPrefsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to save wallpaper"));
    tx.objectStore(DB_STORE).put(blob, CUSTOM_KEY);
  });
  db.close();
}

async function loadCustomBlob(): Promise<Blob | null> {
  const db = await openPrefsDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(CUSTOM_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof Blob ? value : null);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to load wallpaper"));
  });
  db.close();
  return blob;
}

async function deleteCustomBlob() {
  const db = await openPrefsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to remove wallpaper"));
    tx.objectStore(DB_STORE).delete(CUSTOM_KEY);
  });
  db.close();
}

export function WallpaperProvider({ children }: { children: ReactNode }) {
  const [wallpaperId, setWallpaperId] = useState<WallpaperId>(readStoredId);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [hasCustom, setHasCustom] = useState(false);

  const replaceCustomUrl = useCallback((next: string | null) => {
    setCustomUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return next;
    });
  }, []);

  const refreshCustom = useCallback(async () => {
    if (typeof indexedDB === "undefined") {
      setHasCustom(false);
      replaceCustomUrl(null);
      return;
    }
    try {
      const blob = await loadCustomBlob();
      if (!blob) {
        setHasCustom(false);
        replaceCustomUrl(null);
        return;
      }
      setHasCustom(true);
      replaceCustomUrl(URL.createObjectURL(blob));
    } catch {
      setHasCustom(false);
      replaceCustomUrl(null);
    }
  }, [replaceCustomUrl]);

  useEffect(() => {
    // IndexedDB is an external store; hydrate once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load custom wallpaper blob
    void refreshCustom();

    function onChange() {
      setWallpaperId(readStoredId());
      void refreshCustom();
    }

    window.addEventListener(CUSTOM_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CUSTOM_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshCustom]);

  useEffect(() => {
    return () => {
      if (customUrl) URL.revokeObjectURL(customUrl);
    };
  }, [customUrl]);

  const setWallpaper = useCallback(
    (id: WallpaperId) => {
      if (id === "custom" && !hasCustom && !customUrl) return;
      setWallpaperId(id);
      writeStoredId(id);
    },
    [customUrl, hasCustom],
  );

  const setCustomWallpaper = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("Choose an image file.");
      }
      if (file.size > MAX_CUSTOM_BYTES) {
        throw new Error("Image must be 8 MB or smaller.");
      }
      await saveCustomBlob(file);
      const nextUrl = URL.createObjectURL(file);
      setHasCustom(true);
      replaceCustomUrl(nextUrl);
      setWallpaperId("custom");
      writeStoredId("custom");
    },
    [replaceCustomUrl],
  );

  const clearCustomWallpaper = useCallback(async () => {
    await deleteCustomBlob();
    setHasCustom(false);
    replaceCustomUrl(null);
    if (readStoredId() === "custom") {
      setWallpaperId(DEFAULT_WALLPAPER_ID);
      writeStoredId(DEFAULT_WALLPAPER_ID);
    }
  }, [replaceCustomUrl]);

  const wallpaperSrc = wallpaperId === "custom" && customUrl ? customUrl : builtInSrc(wallpaperId);

  const value = useMemo(
    () => ({
      wallpaperId,
      wallpaperSrc,
      customSrc: customUrl,
      hasCustom,
      setWallpaper,
      setCustomWallpaper,
      clearCustomWallpaper,
    }),
    [
      clearCustomWallpaper,
      customUrl,
      hasCustom,
      setCustomWallpaper,
      setWallpaper,
      wallpaperId,
      wallpaperSrc,
    ],
  );

  return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>;
}

export function useWallpaper() {
  const context = useContext(WallpaperContext);
  if (!context) {
    throw new Error("useWallpaper must be used within WallpaperProvider");
  }
  return context;
}

export function WallpaperBackdrop({
  className = "pointer-events-none absolute inset-0 bg-cover bg-center",
  opacity,
}: {
  className?: string;
  opacity?: number;
}) {
  const { wallpaperSrc } = useWallpaper();
  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundImage: `url("${wallpaperSrc}")`,
        ...(opacity === undefined ? {} : { opacity }),
      }}
    />
  );
}

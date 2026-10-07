"use client";

import {
  Clock3,
  HardDrive,
  House,
  Layers,
  ScrollText,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { FILE_DROP_ATTR } from "@/src/components/apps/files/use-file-move-drag";
import { TitlebarTrafficLights, useTitlebarProps } from "@/src/components/window/window-chrome";

type Place = { label: string; path: string; icon: LucideIcon };

/** Finder sidebar: window controls on top, then Favorites and Locations. */
export function FilesSidebar({
  path,
  homePath,
  serverName,
  onNavigate,
}: {
  path: string;
  homePath: string;
  serverName: string;
  onNavigate: (path: string) => void;
}) {
  const titlebar = useTitlebarProps();
  const favorites: Place[] = [
    { label: "Home", path: homePath, icon: House },
    { label: "tmp", path: "/tmp", icon: Clock3 },
    { label: "etc", path: "/etc", icon: Settings2 },
    { label: "var", path: "/var", icon: Layers },
    { label: "Logs", path: "/var/log", icon: ScrollText },
  ];
  const locations: Place[] = [{ label: serverName, path: "/", icon: HardDrive }];

  return (
    <aside className="sui-finder-sidebar flex w-[200px] shrink-0 flex-col select-none">
      <div className="flex h-[52px] shrink-0 items-center px-4" {...titlebar}>
        <TitlebarTrafficLights />
      </div>
      <nav aria-label="Places" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        <Section title="Favorites" places={favorites} path={path} onNavigate={onNavigate} />
        <Section title="Locations" places={locations} path={path} onNavigate={onNavigate} />
      </nav>
    </aside>
  );
}

function Section({
  title,
  places,
  path,
  onNavigate,
}: {
  title: string;
  places: Place[];
  path: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[var(--finder-section)] px-2.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </p>
      <ul className="space-y-px">
        {places.map((place) => {
          const Icon = place.icon;
          const active = path === place.path;
          return (
            <li key={`${title}-${place.path}`}>
              <button
                type="button"
                {...{ [FILE_DROP_ATTR]: place.path }}
                aria-current={active ? "page" : undefined}
                data-active={active}
                className="sui-finder-nav-item flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[5px] text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                onClick={() => onNavigate(place.path)}
              >
                <Icon
                  aria-hidden
                  className="text-[var(--finder-accent)] size-4 shrink-0"
                  strokeWidth={1.8}
                />
                <span className="truncate">{place.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

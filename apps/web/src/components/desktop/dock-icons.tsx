"use client";

import type { ComponentType, CSSProperties } from "react";
import { Launchpad, Safari, TablePlus } from "dusk-react";
import {
  EditorMacIcon,
  FilesMacIcon,
  InfoMacIcon,
  MonitorMacIcon,
  SettingsMacIcon,
  TerminalMacIcon,
} from "@/src/components/desktop/mac-icons";
import type { DockAppId } from "@/src/data/apps";
import { useOptionalServer } from "@/src/lib/api/server-context";

type IconProps = { className?: string; style?: CSSProperties };

type DuskGlyph = ComponentType<{
  className?: string;
  size?: number;
  bg?: string;
  fg?: string;
  fg2?: string;
  circle?: boolean;
}>;

function MacDuskIcon({
  Icon,
  className,
  bg,
  fg,
  fg2,
}: {
  Icon: DuskGlyph;
  className?: string;
  bg: string;
  fg: string;
  fg2?: string;
}) {
  return (
    <span className={`sui-mac-app-icon ${className ?? ""}`} aria-hidden>
      <Icon className="sui-mac-dusk-glyph" size={64} bg={bg} fg={fg} fg2={fg2} circle />
    </span>
  );
}

export function DashboardGlyph({ className }: IconProps) {
  const ctx = useOptionalServer();
  const online = ctx?.server?.status === "online";
  const cpuUsage = online && typeof ctx?.server?.cpuUsage === "number" ? ctx.server.cpuUsage : 0;
  return <MonitorMacIcon className={className} cpuUsage={cpuUsage} />;
}

export function FilesGlyph({ className }: IconProps) {
  return <FilesMacIcon className={className} />;
}

export function TerminalGlyph({ className }: IconProps) {
  return <TerminalMacIcon className={className} />;
}

export function EditorGlyph({ className }: IconProps) {
  return <EditorMacIcon className={className} />;
}

export function ApplicationsGlyph({ className }: IconProps) {
  return <MacDuskIcon Icon={Launchpad} className={className} bg="#2A2B2E" fg="#E4E6EA" />;
}

export function DomainsGlyph({ className }: IconProps) {
  return <MacDuskIcon Icon={Safari} className={className} bg="#4A5D6C" fg="#E4E6EA" />;
}

export function DatabasesGlyph({ className }: IconProps) {
  return <MacDuskIcon Icon={TablePlus} className={className} bg="#4A6570" fg="#E4E6EA" />;
}

export function SettingsGlyph({ className }: IconProps) {
  return <SettingsMacIcon className={className} />;
}

export function InfoGlyph({ className }: IconProps) {
  return <InfoMacIcon className={className} />;
}

export const DOCK_GLYPHS: Record<DockAppId | "info", ComponentType<IconProps>> = {
  dashboard: DashboardGlyph,
  files: FilesGlyph,
  terminal: TerminalGlyph,
  editor: EditorGlyph,
  applications: ApplicationsGlyph,
  domains: DomainsGlyph,
  databases: DatabasesGlyph,
  settings: SettingsGlyph,
  info: InfoGlyph,
};

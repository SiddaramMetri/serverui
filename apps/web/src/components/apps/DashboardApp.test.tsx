import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardApp } from "./DashboardApp";

vi.mock("@/src/lib/session", () => ({
  useSelectedServer: () => ({
    id: "srv_1",
    name: "Edge",
    address: "203.0.113.10",
    username: "deploy",
  }),
}));

vi.mock("@/src/lib/api/server-context", () => ({
  useServer: () => ({
    server: {
      id: "srv_1",
      name: "Edge",
      hostname: "edge-01",
      status: "online",
      host: "203.0.113.10",
      username: "deploy",
      cpuUsage: 2,
      memoryUsage: 17,
      diskUsage: 12,
      uptimeSeconds: 3600,
      cpuCores: 4,
      processes: [{ pid: 42, name: "node", cpu: 1.2, memory: 0.4, memoryBytes: 1400000 }],
      services: [{ name: "ssh", state: "running" }],
      history: [],
    },
    loading: false,
    error: null,
    lastUpdatedAt: Date.now(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/src/lib/api/server", async () => {
  const actual =
    await vi.importActual<typeof import("@/src/lib/api/server")>("@/src/lib/api/server");
  return {
    ...actual,
    getServerMetrics: vi.fn(async () => ({
      id: "srv_1",
      name: "Edge",
      hostname: "edge-01",
      status: "online",
      host: "203.0.113.10",
      username: "deploy",
      cpuUsage: 3,
      memoryUsage: 18,
      diskUsage: 12,
      uptimeSeconds: 3600,
      cpuCores: 4,
      processes: [{ pid: 42, name: "node", cpu: 1.2, memory: 0.4, memoryBytes: 1400000 }],
      services: [{ name: "ssh", state: "running" }],
      history: [],
    })),
  };
});

describe("DashboardApp", () => {
  it("renders overview with live metric cards and navigation", async () => {
    render(<DashboardApp />);
    expect(screen.getByRole("heading", { name: "System Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Top Processes")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("System Information")).toBeInTheDocument();
  });
});

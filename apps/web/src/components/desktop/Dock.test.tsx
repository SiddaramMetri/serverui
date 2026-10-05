import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dock } from "@/src/components/desktop/Dock";
import { WindowManagerProvider } from "@/src/components/window/window-context";

function renderDock(onComingSoon = vi.fn()) {
  render(
    <WindowManagerProvider>
      <Dock onComingSoon={onComingSoon} />
    </WindowManagerProvider>,
  );
  return onComingSoon;
}

describe("Dock", () => {
  it("renders working and coming-soon apps", () => {
    renderDock();
    expect(screen.getByRole("button", { name: "System Monitor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editor" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Applications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Domains" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Databases" })).not.toBeInTheDocument();
  });

  it("marks an app as open after it is selected", async () => {
    const user = userEvent.setup();
    renderDock();
    const files = screen.getByRole("button", { name: "Files" });
    expect(files).toHaveAttribute("aria-pressed", "false");
    await user.click(files);
    expect(files).toHaveAttribute("aria-pressed", "true");
    await user.click(files);
    expect(files).toHaveAttribute("aria-pressed", "true");
    expect(files).not.toHaveAttribute("aria-current");
  });

  it("opens About from the info dock icon", async () => {
    const user = userEvent.setup();
    renderDock();
    const info = screen.getByRole("button", { name: "Info" });
    expect(info).toHaveAttribute("aria-pressed", "false");
    await user.click(info);
    expect(info).toHaveAttribute("aria-pressed", "true");
  });
});

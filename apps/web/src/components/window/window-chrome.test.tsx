import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  TitlebarTrafficLights,
  WindowChromeProvider,
  useTitlebarProps,
  type WindowChromeValue,
} from "@/src/components/window/window-chrome";

function Toolbar() {
  const titlebar = useTitlebarProps();
  return (
    <div data-testid="toolbar" {...titlebar}>
      <TitlebarTrafficLights />
      <button type="button">Upload</button>
    </div>
  );
}

function renderWithChrome() {
  const chrome: WindowChromeValue = {
    focused: true,
    maximized: false,
    onDragStart: vi.fn(),
    onMaximize: vi.fn(),
    onMinimize: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <WindowChromeProvider value={chrome}>
      <Toolbar />
    </WindowChromeProvider>,
  );
  return chrome;
}

describe("unified window title bar", () => {
  it("drags and zooms from empty toolbar space", () => {
    const chrome = renderWithChrome();
    const toolbar = screen.getByTestId("toolbar");
    fireEvent.pointerDown(toolbar);
    fireEvent.doubleClick(toolbar);
    expect(chrome.onDragStart).toHaveBeenCalledTimes(1);
    expect(chrome.onMaximize).toHaveBeenCalledTimes(1);
  });

  it("leaves buttons inside the toolbar alone", () => {
    const chrome = renderWithChrome();
    const upload = screen.getByRole("button", { name: "Upload" });
    fireEvent.pointerDown(upload);
    fireEvent.doubleClick(upload);
    expect(chrome.onDragStart).not.toHaveBeenCalled();
    expect(chrome.onMaximize).not.toHaveBeenCalled();
  });

  it("renders working traffic lights", () => {
    const chrome = renderWithChrome();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    expect(chrome.onClose).toHaveBeenCalled();
    expect(chrome.onMinimize).toHaveBeenCalled();
    expect(chrome.onDragStart).not.toHaveBeenCalled();
  });

  it("is inert outside a window", () => {
    render(<Toolbar />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).not.toHaveAttribute("onpointerdown");
  });
});

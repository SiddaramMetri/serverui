import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileToolbar } from "@/src/components/apps/files/FileToolbar";

function setup(overrides: Partial<Parameters<typeof FileToolbar>[0]> = {}) {
  const props: Parameters<typeof FileToolbar>[0] = {
    title: "config",
    canGoBack: true,
    canGoForward: false,
    onBack: vi.fn(),
    onForward: vi.fn(),
    view: "icons",
    onViewChange: vi.fn(),
    selectedCount: 0,
    query: "",
    onQueryChange: vi.fn(),
    onUploadClick: vi.fn(),
    onNewFolder: vi.fn(),
    onNewFile: vi.fn(),
    onOpen: vi.fn(),
    onDownload: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onCopyPath: vi.fn(),
    onTerminalHere: vi.fn(),
    ...overrides,
  };
  render(<FileToolbar {...props} />);
  return props;
}

describe("FileToolbar", () => {
  it("shows the folder title and history buttons", async () => {
    const props = setup();
    expect(screen.getByRole("heading", { name: "config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it("switches between icon and list views", async () => {
    const props = setup();
    expect(screen.getByRole("radio", { name: "Icon view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("radio", { name: "List view" }));
    expect(props.onViewChange).toHaveBeenCalledWith("list");
  });

  it("disables selection actions until something is selected", () => {
    setup();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "New folder" })).toBeEnabled();
  });

  it("offers the remaining actions in the more menu", async () => {
    const props = setup({ selectedCount: 1 });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(props.onRename).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Clear Selection" }));
    expect(props.onClearSelection).toHaveBeenCalled();
  });

  it("offers Select All when nothing is selected and closes on Escape", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeDisabled();
    await userEvent.click(screen.getByRole("menuitem", { name: "Select All" }));
    expect(props.onSelectAll).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

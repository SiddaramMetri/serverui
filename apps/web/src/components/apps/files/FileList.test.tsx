import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileList } from "@/src/components/apps/files/FileList";
import type { FileEntry } from "@/src/lib/api/files";

const entries: FileEntry[] = [
  {
    name: "file1.txt",
    path: "/home/file1.txt",
    type: "file",
    size: 1024,
    mode: "-rw-r--r--",
    modified: "2026-03-30T10:00:00Z",
  },
  {
    name: "file2.txt",
    path: "/home/file2.txt",
    type: "file",
    size: 2048,
    mode: "-rw-r--r--",
    modified: "2026-03-30T10:00:00Z",
  },
  {
    name: "folderA",
    path: "/home/folderA",
    type: "dir",
    size: 0,
    mode: "drwxr-xr-x",
    modified: "2026-03-30T10:00:00Z",
  },
];

describe("FileList", () => {
  it("renders files and headers without checkboxes", () => {
    render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set()}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onSelectRange={vi.fn()}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();

    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("file2.txt")).toBeInTheDocument();
    expect(screen.getByText("folderA")).toBeInTheDocument();

    // Verify NO checkboxes are rendered
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("applies highlighted sui-selected class to selected rows", () => {
    render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set(["/home/file1.txt", "/home/folderA"])}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onSelectRange={vi.fn()}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row1 = screen.getByText("file1.txt").closest("tr");
    const row2 = screen.getByText("file2.txt").closest("tr");
    const row3 = screen.getByText("folderA").closest("tr");

    expect(row1).toHaveClass("sui-selected");
    expect(row2).not.toHaveClass("sui-selected");
    expect(row3).toHaveClass("sui-selected");
  });

  it("handles single click on row", async () => {
    const onSelect = vi.fn();

    render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set()}
        onSelect={onSelect}
        onToggleSelect={vi.fn()}
        onSelectRange={vi.fn()}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row = screen.getByText("file2.txt").closest("tr")!;
    fireEvent.mouseDown(row, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(row, { clientX: 100, clientY: 100 });

    expect(onSelect).toHaveBeenCalledWith("/home/file2.txt", expect.anything());
  });

  it("handles Ctrl/Cmd + click to toggle row selection", async () => {
    const onToggleSelect = vi.fn();

    render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set(["/home/file1.txt"])}
        onSelect={vi.fn()}
        onToggleSelect={onToggleSelect}
        onSelectRange={vi.fn()}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row = screen.getByText("file2.txt").closest("tr")!;
    fireEvent.mouseDown(row, { clientX: 100, clientY: 100, ctrlKey: true });
    fireEvent.mouseUp(row, { clientX: 100, clientY: 100, ctrlKey: true });

    expect(onToggleSelect).toHaveBeenCalledWith("/home/file2.txt");
  });

  it("handles Shift + click for range selection", async () => {
    const onSelectRange = vi.fn();

    render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set(["/home/file1.txt"])}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onSelectRange={onSelectRange}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row = screen.getByText("folderA").closest("tr")!;
    fireEvent.mouseDown(row, { clientX: 100, clientY: 100, shiftKey: true });
    fireEvent.mouseUp(row, { clientX: 100, clientY: 100, shiftKey: true });

    expect(onSelectRange).toHaveBeenCalledWith("/home/folderA");
  });

  it("clears selection when clicking empty area", async () => {
    const onClearSelection = vi.fn();

    const { container } = render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set(["/home/file1.txt"])}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onSelectRange={vi.fn()}
        onClearSelection={onClearSelection}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const listDiv = container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(listDiv, { clientX: 10, clientY: 500 });
    fireEvent.mouseUp(listDiv, { clientX: 10, clientY: 500 });

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("renders marquee rectangle and updates selection when dragging across files", () => {
    const onSelectionChange = vi.fn();

    const { container } = render(
      <FileList
        path="/home"
        entries={entries}
        selectedPaths={new Set()}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onSelectRange={vi.fn()}
        onSelectionChange={onSelectionChange}
        onClearSelection={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const listDiv = container.firstElementChild as HTMLElement;

    vi.spyOn(listDiv, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const rows = listDiv.querySelectorAll("tr[data-path]");
    rows.forEach((row, i) => {
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 50 + i * 40,
        right: 500,
        bottom: 50 + (i + 1) * 40,
        width: 500,
        height: 40,
        x: 0,
        y: 50 + i * 40,
        toJSON: () => {},
      });
    });

    fireEvent.mouseDown(listDiv, { clientX: 10, clientY: 40 });
    fireEvent.mouseMove(window, { clientX: 300, clientY: 150 });

    expect(screen.getByTestId("selection-marquee")).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalled();

    fireEvent.mouseUp(window, { clientX: 300, clientY: 150 });
    expect(screen.queryByTestId("selection-marquee")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileGrid } from "@/src/components/apps/files/FileGrid";
import { FileList } from "@/src/components/apps/files/FileList";
import { kindLabel } from "@/src/components/apps/files/file-icons";
import type { FileEntry } from "@/src/lib/api/files";

function entry(name: string, type: "file" | "dir"): FileEntry {
  return {
    name,
    path: `/${name}`,
    type,
    size: 12,
    mode: "0644",
    modified: "2026-01-01T00:00:00Z",
  };
}

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
}

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

describe("FileList drag move", () => {
  it("moves a file onto a folder drop", () => {
    const onMove = vi.fn();
    render(
      <FileList
        path="/"
        entries={[entry("notes.txt", "file"), entry("docs", "dir")]}
        selected={null}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onParent={vi.fn()}
        onContextMenu={vi.fn()}
        onMove={onMove}
      />,
    );
    const fileRow = screen.getByText("notes.txt").closest("tr");
    const folderRow = screen.getByText("docs").closest("tr");
    expect(fileRow).toBeTruthy();
    expect(folderRow).toBeTruthy();
    document.elementFromPoint = () => folderRow;

    fireEvent.pointerDown(fileRow!, { clientX: 10, clientY: 10, button: 0 });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    window.dispatchEvent(pointer("pointerup", 40, 40));

    expect(onMove).toHaveBeenCalledWith("/notes.txt", "/docs", "file");
  });
});

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
    expect(screen.getByText("Date Modified")).toBeInTheDocument();
    expect(screen.getByText("Kind")).toBeInTheDocument();

    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("file2.txt")).toBeInTheDocument();
    expect(screen.getByText("folderA")).toBeInTheDocument();

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

const gridEntries: FileEntry[] = [
  {
    name: "docs",
    path: "/srv/docs",
    type: "dir",
    size: 0,
    mode: "drwxr-xr-x",
    modified: "2026-10-01T10:00:00Z",
  },
  {
    name: "site.zip",
    path: "/srv/site.zip",
    type: "file",
    size: 2048,
    mode: "-rw-r--r--",
    modified: "2026-10-01T10:00:00Z",
  },
];

function renderGrid(overrides: Partial<Parameters<typeof FileGrid>[0]> = {}) {
  const props: Parameters<typeof FileGrid>[0] = {
    path: "/srv",
    entries: gridEntries,
    selectedPaths: new Set(),
    onSelect: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectRange: vi.fn(),
    onSelectionChange: vi.fn(),
    onClearSelection: vi.fn(),
    onOpen: vi.fn(),
    onContextMenu: vi.fn(),
    ...overrides,
  };
  render(<FileGrid {...props} />);
  return props;
}

describe("FileGrid", () => {
  it("renders an option per entry and marks the selection", () => {
    renderGrid({ selectedPaths: new Set(["/srv/site.zip"]) });
    expect(screen.getByRole("listbox", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "docs" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("option", { name: "site.zip" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("makes folders drop targets for moving files", () => {
    renderGrid();
    expect(screen.getByRole("option", { name: "docs" })).toHaveAttribute(
      "data-file-drop",
      "/srv/docs",
    );
    expect(screen.getByRole("option", { name: "site.zip" })).not.toHaveAttribute("data-file-drop");
  });
});

describe("kindLabel", () => {
  it("describes entries the way Finder's Kind column does", () => {
    expect(kindLabel({ name: "docs", type: "dir" })).toBe("Folder");
    expect(kindLabel({ name: "site.zip", type: "file" })).toBe("ZIP archive");
    expect(kindLabel({ name: "backup.tar.gz", type: "file" })).toBe("Gzip tar archive");
    expect(kindLabel({ name: "photo.png", type: "file" })).toBe("PNG image");
    expect(kindLabel({ name: "README", type: "file" })).toBe("Plain text");
    expect(kindLabel({ name: "dump.bin", type: "file" })).toBe("BIN file");
  });
});

describe("FileList parent row", () => {
  it("goes up on double click only, like opening a folder", () => {
    const onParent = vi.fn();
    render(
      <FileList
        path="/home"
        entries={entries}
        selected={null}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onParent={onParent}
        onContextMenu={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const parentRow = screen.getByText("..").closest("tr")!;
    fireEvent.click(parentRow);
    expect(onParent).not.toHaveBeenCalled();
    fireEvent.doubleClick(parentRow);
    expect(onParent).toHaveBeenCalledTimes(1);
  });
});

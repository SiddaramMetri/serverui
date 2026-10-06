import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileList } from "./FileList";
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

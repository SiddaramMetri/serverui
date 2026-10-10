import { describe, expect, it } from "vitest";
import { layoutShortcuts, moveShortcut, parseShortcuts } from "@/src/lib/desktop-shortcuts";

describe("parseShortcuts", () => {
  it("reads the old path list and keeps unique absolute paths", () => {
    expect(parseShortcuts('["/var/www", "/var/www", "relative", 3, "/etc"]')).toEqual([
      { path: "/var/www" },
      { path: "/etc" },
    ]);
  });

  it("keeps saved cells and drops invalid ones", () => {
    expect(
      parseShortcuts(
        '[{"path":"/a","col":2,"row":1},{"path":"/b","col":-1,"row":0},{"path":"/c"}]',
      ),
    ).toEqual([{ path: "/a", col: 2, row: 1 }, { path: "/b" }, { path: "/c" }]);
  });

  it("returns empty on missing or malformed storage", () => {
    expect(parseShortcuts(null)).toEqual([]);
    expect(parseShortcuts("{nope")).toEqual([]);
    expect(parseShortcuts('{"a":1}')).toEqual([]);
  });
});

describe("layoutShortcuts", () => {
  it("fills free cells from the rightmost column, top to bottom", () => {
    const cells = layoutShortcuts([{ path: "/a" }, { path: "/b" }, { path: "/c" }], 4, 2);
    expect(cells.get("/a")).toEqual({ col: 3, row: 0 });
    expect(cells.get("/b")).toEqual({ col: 3, row: 1 });
    expect(cells.get("/c")).toEqual({ col: 2, row: 0 });
  });

  it("keeps saved cells, clamps them to a smaller grid and skips taken cells", () => {
    const cells = layoutShortcuts(
      [{ path: "/a", col: 9, row: 9 }, { path: "/b", col: 3, row: 0 }, { path: "/c" }],
      4,
      2,
    );
    expect(cells.get("/a")).toEqual({ col: 3, row: 1 });
    expect(cells.get("/b")).toEqual({ col: 3, row: 0 });
    expect(cells.get("/c")).toEqual({ col: 2, row: 0 });
  });
});

describe("moveShortcut", () => {
  it("drops on a free cell and swaps with an occupied one", () => {
    const items = [{ path: "/a" }, { path: "/b" }];
    const cells = layoutShortcuts(items, 4, 2);

    expect(moveShortcut(items, cells, "/a", { col: 0, row: 0 })).toEqual([
      { path: "/a", col: 0, row: 0 },
      { path: "/b", col: 3, row: 1 },
    ]);
    expect(moveShortcut(items, cells, "/a", { col: 3, row: 1 })).toEqual([
      { path: "/a", col: 3, row: 1 },
      { path: "/b", col: 3, row: 0 },
    ]);
  });
});

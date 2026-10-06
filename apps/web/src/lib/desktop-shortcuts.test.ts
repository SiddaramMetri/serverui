import { describe, expect, it } from "vitest";
import { parseShortcuts } from "@/src/lib/desktop-shortcuts";

describe("parseShortcuts", () => {
  it("keeps unique absolute paths and drops junk", () => {
    expect(parseShortcuts('["/var/www", "/var/www", "relative", 3, "/etc"]')).toEqual([
      "/var/www",
      "/etc",
    ]);
  });

  it("returns empty on missing or malformed storage", () => {
    expect(parseShortcuts(null)).toEqual([]);
    expect(parseShortcuts("{nope")).toEqual([]);
    expect(parseShortcuts('{"a":1}')).toEqual([]);
  });
});

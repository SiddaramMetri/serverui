import { afterEach, describe, expect, it } from "vitest";
import { destAtPoint, FILE_DROP_ATTR } from "./use-file-move-drag";

describe("destAtPoint", () => {
  afterEach(() => {
    document.body.replaceChildren();
    // @ts-expect-error jsdom stub
    delete document.elementFromPoint;
  });

  it("resolves a folder drop target under the pointer", () => {
    const folder = document.createElement("div");
    folder.setAttribute(FILE_DROP_ATTR, "/docs");
    document.body.append(folder);
    document.elementFromPoint = () => folder;
    expect(destAtPoint(12, 12, "/notes.txt", "/")).toBe("/docs");
  });

  it("ignores the current directory and the dragged item", () => {
    const folder = document.createElement("div");
    folder.setAttribute(FILE_DROP_ATTR, "/docs");
    document.body.append(folder);
    document.elementFromPoint = () => folder;
    expect(destAtPoint(12, 12, "/docs/a.txt", "/docs")).toBeNull();
    expect(destAtPoint(12, 12, "/docs", "/")).toBeNull();
  });
});

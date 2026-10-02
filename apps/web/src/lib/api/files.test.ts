import { describe, expect, it } from "vitest";
import {
  baseName,
  buildMoveDestination,
  isValidMove,
  joinPath,
  parentPath,
  suggestUniqueName,
} from "@/src/lib/api/files";

describe("file path helpers", () => {
  it("joins names onto a directory", () => {
    expect(joinPath("/", "etc")).toBe("/etc");
    expect(joinPath("/home/deploy", "notes.txt")).toBe("/home/deploy/notes.txt");
    expect(joinPath("/var/", "log")).toBe("/var/log");
  });

  it("returns the parent directory", () => {
    expect(parentPath("/")).toBe("/");
    expect(parentPath("/etc")).toBe("/");
    expect(parentPath("/home/deploy/notes.txt")).toBe("/home/deploy");
  });

  it("returns the base name", () => {
    expect(baseName("/home/deploy/notes.txt")).toBe("notes.txt");
    expect(baseName("/")).toBe("");
  });

  it("builds a move destination inside the target folder", () => {
    expect(buildMoveDestination("/folder-a", "/file.txt")).toBe("/folder-a/file.txt");
    expect(buildMoveDestination("/", "/a/b.txt")).toBe("/b.txt");
  });

  it("rejects moves into itself or descendants", () => {
    expect(isValidMove("/a", "dir", "/a")).toBe(false);
    expect(isValidMove("/a", "dir", "/a/b")).toBe(false);
    expect(isValidMove("/a/b.txt", "file", "/")).toBe(true);
    expect(isValidMove("/file.txt", "file", "/folder-a")).toBe(true);
    expect(isValidMove("/folder-a/file.txt", "file", "/folder-a")).toBe(false);
  });

  it("suggests a unique name when a conflict exists", () => {
    expect(suggestUniqueName(["file.txt"], "file.txt")).toBe("file (1).txt");
    expect(suggestUniqueName(["a", "a (1)"], "a")).toBe("a (2)");
  });
});

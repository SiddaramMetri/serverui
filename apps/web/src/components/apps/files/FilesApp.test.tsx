import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesApp } from "@/src/components/apps/files/FilesApp";
import { WindowManagerProvider } from "@/src/components/window/window-context";
import type { ExtractJob, FileEntry } from "@/src/lib/api/files";

const mockEntries: FileEntry[] = [
  {
    name: "alpha.txt",
    path: "/home/alpha.txt",
    type: "file",
    size: 100,
    mode: "-rw-r--r--",
    modified: "2026-03-30T10:00:00Z",
  },
  {
    name: "beta.txt",
    path: "/home/beta.txt",
    type: "file",
    size: 200,
    mode: "-rw-r--r--",
    modified: "2026-03-30T10:00:00Z",
  },
  {
    name: "gamma_folder",
    path: "/home/gamma_folder",
    type: "dir",
    size: 0,
    mode: "drwxr-xr-x",
    modified: "2026-03-30T10:00:00Z",
  },
];

const { listFilesMock, deleteFileMock, mocks } = vi.hoisted(() => ({
  listFilesMock: vi.fn(),
  deleteFileMock: vi.fn(),
  mocks: {
    startExtract: vi.fn(),
    getExtractJob: vi.fn(),
    resolveExtract: vi.fn(),
    cancelExtract: vi.fn(),
  },
}));

vi.mock("@/src/lib/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/api/files")>("@/src/lib/api/files");
  return {
    ...actual,
    listFiles: (...args: unknown[]) => listFilesMock(...args),
    deleteFile: (...args: unknown[]) => deleteFileMock(...args),
    startExtract: (...args: unknown[]) => mocks.startExtract(...args),
    getExtractJob: (...args: unknown[]) => mocks.getExtractJob(...args),
    resolveExtract: (...args: unknown[]) => mocks.resolveExtract(...args),
    cancelExtract: (...args: unknown[]) => mocks.cancelExtract(...args),
    downloadUrl: vi.fn((serverId: string, path: string) => `/mock/download?path=${path}`),
  };
});

vi.mock("@/src/lib/session", () => ({
  useSelectedServer: () => ({ id: "srv-1", name: "Prod", username: "deploy" }),
}));

vi.mock("@/src/lib/api/server-context", () => ({
  useServer: () => ({ server: { username: "deploy" } }),
}));

describe("FilesApp multi-select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFilesMock.mockResolvedValue({
      path: "/",
      entries: mockEntries,
    });
    deleteFileMock.mockResolvedValue({ status: "ok" });
  });

  it("selects multiple items and shows item count in toolbar and status bar", async () => {
    const user = userEvent.setup();

    render(
      <WindowManagerProvider>
        <FilesApp />
      </WindowManagerProvider>,
    );

    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    const rowAlpha = screen.getByText("alpha.txt").closest("tr")!;
    const rowBeta = screen.getByText("beta.txt").closest("tr")!;

    // Select alpha.txt
    fireEvent.mouseDown(rowAlpha, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(rowAlpha, { clientX: 10, clientY: 10 });
    expect(screen.getAllByText("1 item selected").length).toBeGreaterThanOrEqual(1);

    // Ctrl+Click beta.txt
    fireEvent.mouseDown(rowBeta, { clientX: 10, clientY: 20, ctrlKey: true });
    fireEvent.mouseUp(rowBeta, { clientX: 10, clientY: 20, ctrlKey: true });
    expect(screen.getAllByText("2 items selected").length).toBeGreaterThanOrEqual(1);

    // Clear selection
    const clearBtn = screen.getByRole("button", { name: "Clear" });
    await user.click(clearBtn);

    expect(screen.queryByText("2 items selected")).not.toBeInTheDocument();
  });

  it("selects all items via toolbar Select all", async () => {
    const user = userEvent.setup();

    render(
      <WindowManagerProvider>
        <FilesApp />
      </WindowManagerProvider>,
    );

    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    const selectAllBtn = screen.getByRole("button", { name: "Select all" });
    await user.click(selectAllBtn);

    expect(screen.getAllByText("3 items selected").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("alpha.txt").closest("tr")).toHaveClass("sui-selected");
    expect(screen.getByText("beta.txt").closest("tr")).toHaveClass("sui-selected");
    expect(screen.getByText("gamma_folder").closest("tr")).toHaveClass("sui-selected");
  });

  it("handles multi-item delete confirmation and execution", async () => {
    const user = userEvent.setup();

    render(
      <WindowManagerProvider>
        <FilesApp />
      </WindowManagerProvider>,
    );

    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    // Select alpha and beta
    const rowAlpha = screen.getByText("alpha.txt").closest("tr")!;
    const rowBeta = screen.getByText("beta.txt").closest("tr")!;

    fireEvent.mouseDown(rowAlpha, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(rowAlpha, { clientX: 10, clientY: 10 });

    fireEvent.mouseDown(rowBeta, { clientX: 10, clientY: 20, ctrlKey: true });
    fireEvent.mouseUp(rowBeta, { clientX: 10, clientY: 20, ctrlKey: true });

    // Click Delete in toolbar
    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    // Verify confirmation prompt
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Delete 2 items\? This action cannot be undone\./i);

    // Confirm Delete
    const confirmDeleteBtn = screen.getAllByRole("button", { name: "Delete" })[1];
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteFileMock).toHaveBeenCalledWith("srv-1", "/home/alpha.txt");
      expect(deleteFileMock).toHaveBeenCalledWith("srv-1", "/home/beta.txt");
    });
  });

  it("handles multi-item download with status feedback", async () => {
    const user = userEvent.setup();

    render(
      <WindowManagerProvider>
        <FilesApp />
      </WindowManagerProvider>,
    );

    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    // Select alpha.txt and gamma_folder
    const rowAlpha = screen.getByText("alpha.txt").closest("tr")!;
    const rowGamma = screen.getByText("gamma_folder").closest("tr")!;

    fireEvent.mouseDown(rowAlpha, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(rowAlpha, { clientX: 10, clientY: 10 });

    fireEvent.mouseDown(rowGamma, { clientX: 10, clientY: 30, ctrlKey: true });
    fireEvent.mouseUp(rowGamma, { clientX: 10, clientY: 30, ctrlKey: true });

    // Click Download
    const downloadBtn = screen.getByRole("button", { name: "Download" });
    await user.click(downloadBtn);

    // Status feedback communicates downloaded files and skipped folders
    expect(
      await screen.findByText(
        /Downloaded 1 file \(1 folder skipped: folders cannot be downloaded directly\)\./i,
      ),
    ).toBeInTheDocument();
  });

  it("notifies when attempting to download only folders", async () => {
    const user = userEvent.setup();

    render(
      <WindowManagerProvider>
        <FilesApp />
      </WindowManagerProvider>,
    );

    expect(await screen.findByText("gamma_folder")).toBeInTheDocument();

    // Select only gamma_folder
    const rowGamma = screen.getByText("gamma_folder").closest("tr")!;
    fireEvent.mouseDown(rowGamma, { clientX: 10, clientY: 30 });
    fireEvent.mouseUp(rowGamma, { clientX: 10, clientY: 30 });

    // Click Download
    const downloadBtn = screen.getByRole("button", { name: "Download" });
    await user.click(downloadBtn);

    expect(
      await screen.findByText(
        /Folder “gamma_folder” cannot be downloaded directly with the current download architecture\./i,
      ),
    ).toBeInTheDocument();
  });
});

const archiveEntries: FileEntry[] = [
  {
    name: "notes.txt",
    path: "/notes.txt",
    type: "file",
    size: 10,
    mode: "-rw-r--r--",
    modified: "2026-10-01T10:00:00Z",
  },
  {
    name: "site.zip",
    path: "/site.zip",
    type: "file",
    size: 2048,
    mode: "-rw-r--r--",
    modified: "2026-10-01T10:00:00Z",
  },
];

function job(overrides: Partial<ExtractJob>): ExtractJob {
  return {
    id: "job-1",
    state: "scanning",
    archive: "/site.zip",
    destination: "/",
    done: 0,
    total: 0,
    conflicts: [],
    extracted: [],
    ...overrides,
  };
}

const POLL_WAIT = { timeout: 3000 };

async function renderFiles() {
  render(
    <WindowManagerProvider>
      <FilesApp />
    </WindowManagerProvider>,
  );
  expect(await screen.findByText("site.zip")).toBeInTheDocument();
}

function openMenu(name: string) {
  fireEvent.contextMenu(screen.getByText(name).closest("tr")!, { clientX: 20, clientY: 20 });
}

describe("FilesApp archive extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFilesMock.mockResolvedValue({ path: "/", entries: archiveEntries });
  });

  it("offers extraction only for supported archives", async () => {
    await renderFiles();

    openMenu("notes.txt");
    expect(screen.queryByRole("menuitem", { name: "Extract Here" })).not.toBeInTheDocument();

    openMenu("site.zip");
    expect(screen.getByRole("menuitem", { name: "Extract Here" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Extract To…" })).toBeInTheDocument();
  });

  it("extracts here, refreshes the folder, and selects the result", async () => {
    const user = userEvent.setup();
    mocks.startExtract.mockResolvedValue(job({ state: "scanning" }));
    mocks.getExtractJob.mockResolvedValue(
      job({ state: "done", done: 3, total: 3, extracted: ["/site"] }),
    );
    await renderFiles();
    const extracted: FileEntry = { ...archiveEntries[0], name: "site", path: "/site", type: "dir" };
    listFilesMock.mockResolvedValue({ path: "/", entries: [...archiveEntries, extracted] });

    openMenu("site.zip");
    await user.click(screen.getByRole("menuitem", { name: "Extract Here" }));

    expect(mocks.startExtract).toHaveBeenCalledWith("srv-1", "/site.zip", "here", undefined);
    expect(await screen.findByText("Checking “site.zip”…")).toBeInTheDocument();
    expect(
      await screen.findByText("Extracted “site.zip” to /site.", {}, POLL_WAIT),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("site").closest("tr")).toHaveClass("sui-selected"));
  });

  it("extracts to a chosen folder", async () => {
    const user = userEvent.setup();
    mocks.startExtract.mockResolvedValue(job({ state: "scanning", destination: "/srv/out" }));
    mocks.getExtractJob.mockResolvedValue(
      job({ state: "done", destination: "/srv/out", extracted: ["/srv/out/site"] }),
    );
    await renderFiles();

    openMenu("site.zip");
    await user.click(screen.getByRole("menuitem", { name: "Extract To…" }));
    const input = screen.getByDisplayValue("/site");
    await user.clear(input);
    await user.type(input, "/srv/out");
    await user.click(screen.getByRole("button", { name: "Extract" }));

    expect(mocks.startExtract).toHaveBeenCalledWith("srv-1", "/site.zip", "to", "/srv/out");
    expect(
      await screen.findByText("Extracted “site.zip” to /srv/out/site.", {}, POLL_WAIT),
    ).toBeInTheDocument();
  });

  it("asks before overwriting and continues with keep both", async () => {
    const user = userEvent.setup();
    mocks.startExtract.mockResolvedValue(
      job({ state: "awaiting_decision", total: 2, conflicts: ["site"] }),
    );
    mocks.resolveExtract.mockResolvedValue(job({ state: "extracting", total: 2 }));
    mocks.getExtractJob.mockResolvedValue(
      job({ state: "done", done: 2, total: 2, extracted: ["/site (1)"] }),
    );
    await renderFiles();

    openMenu("site.zip");
    await user.click(screen.getByRole("menuitem", { name: "Extract Here" }));

    const prompt = await screen.findByRole("alertdialog");
    expect(prompt).toHaveTextContent("“site” already exists in /.");
    await user.click(screen.getByRole("button", { name: "Keep both" }));

    expect(mocks.resolveExtract).toHaveBeenCalledWith("srv-1", "job-1", "keep-both");
    expect(
      await screen.findByText("Extracted “site.zip” to /site (1).", {}, POLL_WAIT),
    ).toBeInTheDocument();
  });

  it("shows progress and lets the user cancel", async () => {
    const user = userEvent.setup();
    mocks.startExtract.mockResolvedValue(job({ state: "extracting", done: 1, total: 4 }));
    mocks.getExtractJob.mockResolvedValue(job({ state: "extracting", done: 1, total: 4 }));
    mocks.cancelExtract.mockResolvedValue(job({ state: "extracting", done: 1, total: 4 }));
    await renderFiles();

    openMenu("site.zip");
    await user.click(screen.getByRole("menuitem", { name: "Extract Here" }));

    expect(await screen.findByText("Extracting “site.zip”… 1 of 4 (25%)")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

    mocks.getExtractJob.mockResolvedValue(job({ state: "cancelled", done: 1, total: 4 }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.cancelExtract).toHaveBeenCalledWith("srv-1", "job-1");
    expect(
      await screen.findByText(
        "Extraction of “site.zip” was cancelled. Nothing was changed.",
        {},
        POLL_WAIT,
      ),
    ).toBeInTheDocument();
  });

  it("reports extraction failures", async () => {
    const user = userEvent.setup();
    mocks.startExtract.mockResolvedValue(job({ state: "scanning" }));
    mocks.getExtractJob.mockResolvedValue(
      job({ state: "failed", error: "archive is corrupted or is not a valid ZIP archive" }),
    );
    await renderFiles();

    openMenu("site.zip");
    await user.click(screen.getByRole("menuitem", { name: "Extract Here" }));

    expect(
      await screen.findByText(
        "Couldn’t extract “site.zip”: archive is corrupted or is not a valid ZIP archive.",
        {},
        POLL_WAIT,
      ),
    ).toBeInTheDocument();
  });
});

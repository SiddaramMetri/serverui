import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesApp } from "@/src/components/apps/files/FilesApp";
import { WindowManagerProvider } from "@/src/components/window/window-context";
import { ApiError } from "@/src/lib/api/client";
import type { FileEntry } from "@/src/lib/api/files";

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

const { listFilesMock, deleteFileMock, copyItemMock, moveItemMock, compressItemsMock, fetchMock } =
  vi.hoisted(() => ({
    listFilesMock: vi.fn(),
    deleteFileMock: vi.fn(),
    copyItemMock: vi.fn(),
    moveItemMock: vi.fn(),
    compressItemsMock: vi.fn(),
    fetchMock: vi.fn(),
  }));

vi.mock("@/src/lib/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/api/files")>("@/src/lib/api/files");
  return {
    ...actual,
    listFiles: (...args: unknown[]) => listFilesMock(...args),
    deleteFile: (...args: unknown[]) => deleteFileMock(...args),
    copyItem: (...args: unknown[]) => copyItemMock(...args),
    moveItem: (...args: unknown[]) => moveItemMock(...args),
    compressItems: (...args: unknown[]) => compressItemsMock(...args),
    downloadUrl: vi.fn((_serverId: string, path: string) => `/mock/download?path=${path}`),
  };
});

function renderApp() {
  return render(
    <WindowManagerProvider>
      <FilesApp />
    </WindowManagerProvider>,
  );
}

function select(name: string, modifiers: { ctrlKey?: boolean } = {}) {
  const row = screen.getByText(name).closest("tr")!;
  fireEvent.mouseDown(row, { clientX: 10, clientY: 10, ...modifiers });
  fireEvent.mouseUp(row, { clientX: 10, clientY: 10, ...modifiers });
  return row;
}

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
    copyItemMock.mockResolvedValue({ status: "ok" });
    moveItemMock.mockResolvedValue({ status: "ok" });
    fetchMock.mockImplementation(async () => new Response("data"));
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
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

  it("warns before downloading a selection with folders and offers compression", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    select("alpha.txt");
    select("gamma_folder", { ctrlKey: true });
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /Folders can’t be downloaded directly/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Compress…" }));
    expect(screen.getByLabelText("Archive name")).toHaveValue("Archive.zip");
  });

  it("downloads files with progress and retries only the failed ones", async () => {
    const user = userEvent.setup();
    let betaAttempts = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("beta") && betaAttempts++ === 0) {
        return new Response(JSON.stringify({ error: "permission denied" }), { status: 403 });
      }
      return new Response("data");
    });
    renderApp();
    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    select("alpha.txt");
    select("beta.txt", { ctrlKey: true });
    await user.click(screen.getByRole("button", { name: "Download" }));

    const panel = await screen.findByRole("status", { name: "Downloads" });
    await waitFor(() => expect(panel).toHaveTextContent("1 of 2 complete, 1 failed"));
    expect(panel).toHaveTextContent("Failed: permission denied");

    await user.click(screen.getByRole("button", { name: "Retry failed" }));
    await waitFor(() => expect(panel).toHaveTextContent("2 of 2 complete"));
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((u) => u.includes("alpha"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("beta"))).toHaveLength(2);
  });

  it("copies with the keyboard and asks before replacing on paste", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("alpha.txt")).toBeInTheDocument();

    const row = select("alpha.txt");
    fireEvent.keyDown(row, { key: "c", ctrlKey: true });
    fireEvent.keyDown(row, { key: "v", ctrlKey: true });

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /An item named “alpha.txt” already exists/,
    );
    await user.click(screen.getByRole("button", { name: "Keep Both" }));
    await waitFor(() =>
      expect(copyItemMock).toHaveBeenCalledWith(
        "srv-1",
        "/home/alpha.txt",
        "/alpha (1).txt",
        false,
      ),
    );

    fireEvent.keyDown(select("alpha.txt"), { key: "v", ctrlKey: true });
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(copyItemMock).toHaveBeenCalledWith("srv-1", "/home/alpha.txt", "/alpha.txt", true),
    );
  });

  it("moves cut items and empties the clipboard", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("beta.txt")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText("beta.txt"));
    await user.click(screen.getByRole("menuitem", { name: "Cut" }));
    expect(screen.getByRole("button", { name: "Paste “beta.txt”" })).toBeInTheDocument();

    // The listing already holds a "beta.txt", so pasting here asks first.
    fireEvent.keyDown(select("alpha.txt"), { key: "v", ctrlKey: true });
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(moveItemMock).toHaveBeenCalledWith("srv-1", "/home/beta.txt", "/beta.txt", true),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Paste/ })).not.toBeInTheDocument(),
    );
  });

  it("asks before replacing an existing archive", async () => {
    const user = userEvent.setup();
    compressItemsMock
      .mockRejectedValueOnce(new ApiError("already exists", 409))
      .mockResolvedValueOnce({ status: "ok", path: "/gamma_folder.zip" });
    renderApp();
    expect(await screen.findByText("gamma_folder")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText("gamma_folder"));
    await user.click(screen.getByRole("menuitem", { name: "Compress" }));
    expect(screen.getByLabelText("Archive name")).toHaveValue("gamma_folder.zip");
    await user.selectOptions(screen.getByLabelText("Format"), "tar.gz");
    expect(screen.getByLabelText("Archive name")).toHaveValue("gamma_folder.tar.gz");
    await user.selectOptions(screen.getByLabelText("Format"), "zip");
    await user.click(screen.getByRole("button", { name: "Compress" }));

    expect(await screen.findByText("“gamma_folder.zip” already exists.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(compressItemsMock).toHaveBeenLastCalledWith(
        "srv-1",
        "/",
        ["gamma_folder"],
        "gamma_folder.zip",
        "zip",
        true,
      ),
    );
    expect(await screen.findByText("Created “gamma_folder.zip”.")).toBeInTheDocument();
  });

  it("switches to tar.gz when zip is missing on the server", async () => {
    const user = userEvent.setup();
    compressItemsMock
      .mockRejectedValueOnce(new ApiError("zip is not installed on the server", 400))
      .mockResolvedValueOnce({ status: "ok", path: "/gamma_folder.tar.gz" });
    renderApp();
    expect(await screen.findByText("gamma_folder")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText("gamma_folder"));
    await user.click(screen.getByRole("menuitem", { name: "Compress" }));
    await user.click(screen.getByRole("button", { name: "Compress" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Switched to TAR.GZ/);
    expect(screen.getByLabelText("Format")).toHaveValue("tar.gz");
    expect(screen.getByLabelText("Archive name")).toHaveValue("gamma_folder.tar.gz");

    await user.click(screen.getByRole("button", { name: "Compress" }));
    await waitFor(() =>
      expect(compressItemsMock).toHaveBeenLastCalledWith(
        "srv-1",
        "/",
        ["gamma_folder"],
        "gamma_folder.tar.gz",
        "tar.gz",
        false,
      ),
    );
  });
});

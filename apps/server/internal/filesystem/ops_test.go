package filesystem

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// run executes a generated command with the local sh, the same way the SSH session runs it remotely.
func run(t *testing.T, command string) int {
	t.Helper()
	err := exec.Command("sh", "-c", command).Run()
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		return exit.ExitCode()
	}
	if err != nil {
		t.Fatal(err)
	}
	return 0
}

func write(t *testing.T, p, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func read(t *testing.T, p string) string {
	t.Helper()
	data, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestCopyCommand(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "it's a dir")
	write(t, filepath.Join(src, "a.txt"), "new")
	dest := filepath.Join(dir, "dest")
	write(t, filepath.Join(dest, "old.txt"), "old")

	if code := run(t, copyCommand(src, dest, tempName(dest), false)); code != exitExists {
		t.Fatalf("expected exists exit, got %d", code)
	}
	if code := run(t, copyCommand(src, dest, tempName(dest), true)); code != 0 {
		t.Fatalf("replace failed: %d", code)
	}
	if read(t, filepath.Join(dest, "a.txt")) != "new" || read(t, filepath.Join(src, "a.txt")) != "new" {
		t.Fatal("copy did not replace destination or lost source")
	}
	if _, err := os.Stat(filepath.Join(dest, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("replace kept old content")
	}
}

func TestMoveCommandRestoresSourceOnFailure(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "src.txt")
	write(t, src, "keep me")
	// Destination parent does not exist, so the final mv fails after the source was moved aside.
	dest := filepath.Join(dir, "missing", "dest.txt")
	tmp := filepath.Join(dir, ".serverui-tmp-test")

	if code := run(t, moveCommand(src, dest, tmp, true)); code == 0 {
		t.Fatal("expected failure")
	}
	if read(t, src) != "keep me" {
		t.Fatal("source was not restored")
	}
}

func TestMoveCommandReplace(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "src.txt")
	dest := filepath.Join(dir, "dest.txt")
	write(t, src, "new")
	write(t, dest, "old")
	if code := run(t, moveCommand(src, dest, tempName(dest), false)); code != exitExists {
		t.Fatalf("expected exists exit, got %d", code)
	}
	if code := run(t, moveCommand(src, dest, tempName(dest), true)); code != 0 {
		t.Fatalf("move failed: %d", code)
	}
	if read(t, dest) != "new" {
		t.Fatal("destination not replaced")
	}
	if _, err := os.Stat(src); !os.IsNotExist(err) {
		t.Fatal("source still present")
	}
}

func TestCompressAndExtractRoundTrip(t *testing.T) {
	for _, format := range []string{"zip", "tar", "tar.gz", "tar.bz2", "tar.xz"} {
		t.Run(format, func(t *testing.T) {
			if format == "zip" {
				if _, err := exec.LookPath("zip"); err != nil {
					t.Skip("zip not installed")
				}
			}
			dir := t.TempDir()
			write(t, filepath.Join(dir, "-site", "index.html"), "hello")
			write(t, filepath.Join(dir, "notes.txt"), "notes")
			archive := filepath.Join(dir, "backup"+ArchiveFormats[format])

			command, err := compressCommand(dir, []string{"-site", "notes.txt"}, archive, tempName(archive), format, false)
			if err != nil {
				t.Fatal(err)
			}
			if code := run(t, command); code != 0 {
				t.Fatalf("compress exit %d", code)
			}
			if code := run(t, command); code != exitExists {
				t.Fatalf("expected exists exit on second run, got %d", code)
			}

			target := filepath.Join(dir, "backup")
			extract, err := extractCommand(archive, target)
			if err != nil {
				t.Fatal(err)
			}
			if code := run(t, extract); code != 0 {
				t.Fatalf("extract exit %d", code)
			}
			if read(t, filepath.Join(target, "-site", "index.html")) != "hello" {
				t.Fatal("round trip lost content")
			}
		})
	}
}

func TestCompressFailureLeavesNoArchive(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "out.tar")
	command, err := compressCommand(dir, []string{"does-not-exist"}, archive, tempName(archive), "tar", false)
	if err != nil {
		t.Fatal(err)
	}
	if code := run(t, command); code == 0 {
		t.Fatal("expected failure")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("left files behind: %v", entries)
	}
}

func TestTransferPathsRejectsSelfNesting(t *testing.T) {
	if _, _, err := transferPaths("/var/www", "/var/www/sub/www"); err == nil {
		t.Fatal("expected error")
	}
	if _, _, err := transferPaths("/var/www", "/var/www"); err == nil {
		t.Fatal("expected error")
	}
	if _, _, err := transferPaths("/var/www", "/var/www2"); err != nil {
		t.Fatal(err)
	}
}

func TestArchiveSuffix(t *testing.T) {
	cases := map[string]string{
		"a.tar.gz":  ".tar.gz",
		"A.ZIP":     ".zip",
		"x.tgz":     ".tgz",
		"x.7z":      ".7z",
		"notes.txt": "",
		".zip":      "",
	}
	for in, want := range cases {
		if got := ArchiveSuffix(in); got != want {
			t.Fatalf("%q: got %q want %q", in, got, want)
		}
	}
}

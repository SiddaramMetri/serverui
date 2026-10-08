package archive

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"serverui/server/internal/filesystem"
)

// localRunner runs commands with the local sh, standing in for SSH so the
// generated scripts are exercised against real tar/unzip binaries.
type localRunner struct{}

type localExit struct{ *exec.ExitError }

func (e localExit) ExitStatus() int { return e.ExitCode() }

func (localRunner) Stream(ctx context.Context, _, command string, onLine func(string)) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		onLine(scanner.Text())
	}
	_, _ = io.Copy(io.Discard, stdout)
	err = cmd.Wait()
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return stderr.Bytes(), localExit{exitErr}
	}
	return stderr.Bytes(), err
}

func localNames(_ string, dir string) ([]filesystem.Entry, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, filesystem.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	list := make([]filesystem.Entry, len(entries))
	for i, entry := range entries {
		list[i] = filesystem.Entry{Name: entry.Name()}
	}
	return list, nil
}

func requireTools(t *testing.T, tools ...string) {
	t.Helper()
	for _, tool := range append([]string{"sh", "mktemp", "df"}, tools...) {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skipf("%s not available", tool)
		}
	}
}

// requireInfoZip skips zip tests where unzip is BusyBox's, which the
// service deliberately refuses.
func requireInfoZip(t *testing.T) {
	t.Helper()
	requireTools(t, "unzip")
	out, _ := exec.Command("unzip").CombinedOutput()
	if bytes.Contains(out, []byte("BusyBox")) {
		t.Skip("unzip is BusyBox")
	}
}

type member struct {
	name     string
	body     string
	symlink  string
	isFolder bool
}

func writeZip(t *testing.T, path string, members ...member) {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for _, m := range members {
		f, err := w.Create(m.name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write([]byte(m.body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeTarGz(t *testing.T, path string, members ...member) {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, m := range members {
		hdr := &tar.Header{Name: m.name, Mode: 0o644, Size: int64(len(m.body)), Typeflag: tar.TypeReg, ModTime: time.Now()}
		switch {
		case m.symlink != "":
			hdr.Typeflag, hdr.Linkname, hdr.Size = tar.TypeSymlink, m.symlink, 0
		case m.isFolder:
			hdr.Typeflag, hdr.Mode, hdr.Size = tar.TypeDir, 0o755, 0
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if hdr.Typeflag == tar.TypeReg {
			if _, err := tw.Write([]byte(m.body)); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

func waitFor(t *testing.T, svc *Service, id string, states ...State) Job {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		job, err := svc.Get("srv", id)
		if err != nil {
			t.Fatal(err)
		}
		for _, state := range states {
			if job.State == state {
				return job
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	job, _ := svc.Get("srv", id)
	t.Fatalf("job never reached %v: %+v", states, job)
	return Job{}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func assertNoStaging(t *testing.T, dir string) {
	t.Helper()
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".serverui-extract.") {
			t.Fatalf("staging folder left behind: %s", entry.Name())
		}
	}
}

// tempDir resolves symlinks (macOS /var -> /private/var) so paths compare.
func tempDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestExtractHereSingleRootFolder(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath,
		member{name: "site/index.html", body: "<h1>hi</h1>"},
		member{name: "site/css/app.css", body: "body{}"},
	)
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateDone {
		t.Fatalf("job failed: %+v", job)
	}
	if got := readFile(t, filepath.Join(dir, "site/index.html")); got != "<h1>hi</h1>" {
		t.Fatalf("content %q", got)
	}
	if !reflect.DeepEqual(job.Extracted, []string{filepath.Join(dir, "site")}) {
		t.Fatalf("extracted %v", job.Extracted)
	}
	if job.Total != 2 || job.Done != 2 {
		t.Fatalf("progress %d/%d", job.Done, job.Total)
	}
	assertNoStaging(t, dir)
}

func TestExtractHereWrapsMultipleRoots(t *testing.T) {
	requireTools(t, "tar", "gzip")
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "bundle.tar.gz")
	writeTarGz(t, archivePath, member{name: "a.txt", body: "a"}, member{name: "b.txt", body: "b"})
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateDone {
		t.Fatalf("job failed: %+v", job)
	}
	if readFile(t, filepath.Join(dir, "bundle/a.txt")) != "a" || readFile(t, filepath.Join(dir, "bundle/b.txt")) != "b" {
		t.Fatal("files not wrapped in bundle/")
	}
	if _, err := os.Stat(filepath.Join(dir, "a.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("a.txt should not be extracted loose")
	}
	assertNoStaging(t, dir)
}

func TestExtractToCreatesDestinationAndHandlesAwkwardNames(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	src := filepath.Join(dir, "my dir")
	if err := os.Mkdir(src, 0o755); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(src, "it's a [test]*.zip")
	writeZip(t, archivePath, member{name: "notes $(x).txt", body: "ok"}, member{name: ".env", body: "secret"})
	dest := filepath.Join(dir, "out", "nested folder")
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, dest, ModeTo)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateDone {
		t.Fatalf("job failed: %+v", job)
	}
	if readFile(t, filepath.Join(dest, "notes $(x).txt")) != "ok" || readFile(t, filepath.Join(dest, ".env")) != "secret" {
		t.Fatal("files missing from destination")
	}
	assertNoStaging(t, dest)
}

func TestConflictKeepBoth(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	if err := os.MkdirAll(filepath.Join(dir, "site"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "site/index.html"), []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath, member{name: "site/index.html", body: "new"})
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateAwaitingDecision, StateFailed)
	if !reflect.DeepEqual(job.Conflicts, []string{"site"}) {
		t.Fatalf("conflicts %+v", job)
	}
	if _, err := svc.Resolve("srv", job.ID, PolicyKeepBoth); err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateDone {
		t.Fatalf("job failed: %+v", job)
	}
	if readFile(t, filepath.Join(dir, "site/index.html")) != "old" {
		t.Fatal("existing folder was modified")
	}
	if readFile(t, filepath.Join(dir, "site (1)/index.html")) != "new" {
		t.Fatal("extracted copy missing")
	}
	if !reflect.DeepEqual(job.Extracted, []string{filepath.Join(dir, "site (1)")}) {
		t.Fatalf("extracted %v", job.Extracted)
	}
}

func TestConflictReplace(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	if err := os.MkdirAll(filepath.Join(dir, "site"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "site/stale.html"), []byte("stale"), 0o644); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath, member{name: "site/index.html", body: "new"})
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	waitFor(t, svc, job.ID, StateAwaitingDecision)
	if _, err := svc.Resolve("srv", job.ID, PolicyReplace); err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateDone {
		t.Fatalf("job failed: %+v", job)
	}
	if readFile(t, filepath.Join(dir, "site/index.html")) != "new" {
		t.Fatal("folder not replaced")
	}
	if _, err := os.Stat(filepath.Join(dir, "site/stale.html")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("old folder contents should be gone after replace")
	}
}

func TestCancelWhileAwaitingDecisionLeavesNothing(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	if err := os.Mkdir(filepath.Join(dir, "site"), 0o755); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath, member{name: "site/index.html", body: "new"})
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	waitFor(t, svc, job.ID, StateAwaitingDecision)
	if _, err := svc.Cancel("srv", job.ID); err != nil {
		t.Fatal(err)
	}
	waitFor(t, svc, job.ID, StateCancelled)
	if _, err := os.Stat(filepath.Join(dir, "site/index.html")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("nothing should be extracted after cancel")
	}
	assertNoStaging(t, dir)
}

func TestRejectsZipSlip(t *testing.T) {
	requireInfoZip(t)
	root := tempDir(t)
	dir := filepath.Join(root, "uploads")
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	archivePath := filepath.Join(dir, "evil.zip")
	writeZip(t, archivePath, member{name: "ok.txt", body: "ok"}, member{name: "../evil.sh", body: "boom"})
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateFailed || !strings.Contains(job.Error, "outside the extraction folder") {
		t.Fatalf("expected unsafe failure, got %+v", job)
	}
	if _, err := os.Stat(filepath.Join(root, "evil.sh")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("zip-slip file was written")
	}
	if _, err := os.Stat(filepath.Join(dir, "ok.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("nothing should be extracted from a rejected archive")
	}
}

func TestRejectsSymlinkEscape(t *testing.T) {
	requireTools(t, "tar", "gzip")
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "evil.tar.gz")
	writeTarGz(t, archivePath,
		member{name: "app", isFolder: true},
		member{name: "app/etc", symlink: "/etc"},
		member{name: "app/etc/cron.d/job", body: "* * * * * root id"},
	)
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateFailed || !strings.Contains(job.Error, "links outside") {
		t.Fatalf("expected unsafe failure, got %+v", job)
	}
	if _, err := os.Lstat(filepath.Join(dir, "app")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("nothing should be extracted from a rejected archive")
	}
}

func TestCorruptArchiveFails(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "broken.zip")
	if err := os.WriteFile(archivePath, []byte("this is not a zip file"), 0o644); err != nil {
		t.Fatal(err)
	}
	svc := New(localRunner{}, localNames)

	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateFailed || job.Error != "archive is corrupted or is not a valid ZIP archive" {
		t.Fatalf("got %+v", job)
	}
	assertNoStaging(t, dir)
}

func TestMissingArchiveFails(t *testing.T) {
	requireInfoZip(t)
	svc := New(localRunner{}, localNames)
	job, err := svc.Start("srv", filepath.Join(tempDir(t), "gone.zip"), "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateFailed || job.Error != "file not found" {
		t.Fatalf("got %+v", job)
	}
}

func TestBusyBoxUnzipIsRefused(t *testing.T) {
	requireTools(t, "unzip")
	out, _ := exec.Command("unzip").CombinedOutput()
	if !bytes.Contains(out, []byte("BusyBox")) {
		t.Skip("unzip is not BusyBox")
	}
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath, member{name: "a.txt", body: "a"})
	svc := New(localRunner{}, localNames)
	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	job = waitFor(t, svc, job.ID, StateDone, StateFailed)
	if job.State != StateFailed || !strings.Contains(job.Error, "Info-ZIP unzip is not installed") {
		t.Fatalf("got %+v", job)
	}
}

func TestStartValidatesRequest(t *testing.T) {
	svc := New(localRunner{}, localNames)
	if _, err := svc.Start("srv", "/srv/notes.txt", "", ModeHere); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("unsupported: %v", err)
	}
	if _, err := svc.Start("srv", "/srv/site.zip", "", Mode("sideways")); err == nil {
		t.Fatal("expected invalid mode error")
	}
	if _, err := svc.Start("srv", "/srv/site.zip", " ", ModeTo); err == nil {
		t.Fatal("expected destination error")
	}
	if _, err := svc.Get("other", "missing"); !errors.Is(err, ErrJobNotFound) {
		t.Fatalf("get: %v", err)
	}
	if _, err := svc.Resolve("srv", "missing", Policy("explode")); err == nil {
		t.Fatal("expected policy error")
	}
}

func TestJobsAreScopedToServer(t *testing.T) {
	requireInfoZip(t)
	dir := tempDir(t)
	archivePath := filepath.Join(dir, "site.zip")
	writeZip(t, archivePath, member{name: "a.txt", body: "a"})
	svc := New(localRunner{}, localNames)
	job, err := svc.Start("srv", archivePath, "", ModeHere)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get("another-server", job.ID); !errors.Is(err, ErrJobNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
	waitFor(t, svc, job.ID, StateDone, StateFailed)
}

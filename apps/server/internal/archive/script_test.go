package archive

import (
	"errors"
	"os/exec"
	"runtime"
	"testing"
)

func TestDetect(t *testing.T) {
	cases := map[string]Format{
		"site.zip":         FormatZip,
		"SITE.ZIP":         FormatZip,
		"backup.tar":       FormatTar,
		"backup.tar.gz":    FormatTarGz,
		"backup.tgz":       FormatTarGz,
		"backup.tar.bz2":   FormatTarBz2,
		"backup.tbz2":      FormatTarBz2,
		"backup.tar.xz":    FormatTarXz,
		"backup.txz":       FormatTarXz,
		"photos.7z":        Format7z,
		"v1.2.release.zip": FormatZip,
	}
	for name, want := range cases {
		got, ok := Detect(name)
		if !ok || got != want {
			t.Fatalf("%q: got %q %v want %q", name, got, ok, want)
		}
	}
	for _, name := range []string{"notes.txt", "log.gz", "data.rar", ".zip", "zip"} {
		if _, ok := Detect(name); ok {
			t.Fatalf("%q should not be extractable", name)
		}
	}
}

func TestStem(t *testing.T) {
	cases := map[string]string{
		"backup.tar.gz":    "backup",
		"Site.ZIP":         "Site",
		"v1.2.release.tgz": "v1.2.release",
		"notes.txt":        "notes.txt",
	}
	for name, want := range cases {
		if got := Stem(name); got != want {
			t.Fatalf("%q: got %q want %q", name, got, want)
		}
	}
}

func TestShellQuoteRoundTrips(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix shell quote round-trip requires a non-Windows host")
	}
	if _, err := exec.LookPath("sh"); err != nil {
		t.Skip("sh not available")
	}
	for _, value := range []string{
		"plain",
		"with space",
		"it's",
		`$(echo injected) ; echo "x" \n`,
		"'",
		"",
	} {
		out, err := exec.Command("sh", "-c", "printf '%s' "+ShellQuote(value)).Output()
		if err != nil {
			t.Fatal(err)
		}
		if string(out) != value {
			t.Fatalf("got %q want %q", out, value)
		}
	}
}

func TestToolsetBinary(t *testing.T) {
	tools := parsePreflight("@@tool tar\n@@tool unzip\n@@tool 7za\n@@tool gzip\n@@archive ok\n@@free 2048\n").tools
	if bin, err := tools.binary(FormatZip); err != nil || bin != "unzip" {
		t.Fatalf("zip: %q %v", bin, err)
	}
	if bin, err := tools.binary(Format7z); err != nil || bin != "7za" {
		t.Fatalf("7z: %q %v", bin, err)
	}
	if bin, err := tools.binary(FormatTarGz); err != nil || bin != "tar" {
		t.Fatalf("tar.gz: %q %v", bin, err)
	}
	var missing *MissingToolError
	if _, err := tools.binary(FormatTarXz); !errors.As(err, &missing) || missing.Tool != "xz" {
		t.Fatalf("tar.xz: %v", err)
	}
	if _, err := (toolset{}).binary(FormatZip); !errors.As(err, &missing) || missing.Tool != "unzip" {
		t.Fatalf("zip without unzip: %v", err)
	}
	if _, err := (toolset{"unzip": true, busyboxUnzip: true}).binary(FormatZip); !errors.As(err, &missing) || missing.Tool != "Info-ZIP unzip" {
		t.Fatalf("busybox unzip: %v", err)
	}
}

func TestParsePreflight(t *testing.T) {
	pre := parsePreflight("@@tool tar\n@@tool xz\n@@archive denied\n@@free 4096\n")
	if !pre.tools["tar"] || !pre.tools["xz"] || pre.archive != "denied" || pre.freeKB != 4096 {
		t.Fatalf("got %+v", pre)
	}
	if pre := parsePreflight("@@archive ok\n@@free \n"); pre.freeKB != -1 {
		t.Fatalf("missing df output should be unknown, got %d", pre.freeKB)
	}
}

type fakeExit struct{}

func (fakeExit) Error() string   { return "exit status 1" }
func (fakeExit) ExitStatus() int { return 1 }

func TestClassify(t *testing.T) {
	cases := []struct {
		stderr string
		want   string
	}{
		{"tar: site: Cannot open: Permission denied", "permission denied"},
		{"write error: No space left on device", ErrNoSpace.Error()},
		{"gzip: stdin: not in gzip format", "archive is corrupted or is not a valid tar archive"},
		{"End-of-central-directory signature not found.", "archive is corrupted or is not a valid tar archive"},
		{destinationChanged + ": site", ErrDestinationChanged.Error()},
		{"something unexpected", "extraction failed on the server"},
	}
	for _, tc := range cases {
		if got := classify(FormatTar, []byte(tc.stderr), fakeExit{}).Error(); got != tc.want {
			t.Fatalf("%q: got %q want %q", tc.stderr, got, tc.want)
		}
	}
	if got := classify(FormatZip, nil, errors.New("connection refused")).Error(); got != "unable to connect to server" {
		t.Fatalf("connection error: %q", got)
	}
}

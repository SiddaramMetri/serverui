package filesystem

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"path"
	"strings"

	"golang.org/x/crypto/ssh"
)

// ErrExists is returned when the destination already exists and overwrite was not requested.
var ErrExists = errors.New("already exists")

const (
	exitExists  = 17
	exitMissing = 127
)

// ArchiveFormats lists the formats Compress accepts, keyed by format id, valued by file extension.
var ArchiveFormats = map[string]string{
	"zip":     ".zip",
	"tar":     ".tar",
	"tar.gz":  ".tar.gz",
	"tgz":     ".tgz",
	"tar.bz2": ".tar.bz2",
	"tar.xz":  ".tar.xz",
	"7z":      ".7z",
}

// archiveSuffixes is ordered longest first so ".tar.gz" wins over ".tar".
var archiveSuffixes = []string{".tar.gz", ".tar.bz2", ".tar.xz", ".tgz", ".tbz2", ".txz", ".tar", ".zip", ".7z"}

// ArchiveSuffix returns the archive extension of name, or "" when name is not a supported archive.
func ArchiveSuffix(name string) string {
	lower := strings.ToLower(name)
	for _, suffix := range archiveSuffixes {
		if strings.HasSuffix(lower, suffix) && len(name) > len(suffix) {
			return suffix
		}
	}
	return ""
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func tempName(dest string) string {
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	return path.Join(path.Dir(dest), ".serverui-tmp-"+hex.EncodeToString(buf))
}

func transferPaths(fromRaw, toRaw string) (string, string, error) {
	from, err := CleanPath(fromRaw)
	if err != nil {
		return "", "", err
	}
	to, err := CleanPath(toRaw)
	if err != nil {
		return "", "", err
	}
	if from == "/" || to == "/" || from == to {
		return "", "", fmt.Errorf("invalid path")
	}
	if strings.HasPrefix(to, from+"/") {
		return "", "", fmt.Errorf("cannot place a folder inside itself")
	}
	return from, to, nil
}

func copyCommand(from, to, tmp string, overwrite bool) string {
	f, t, x := shellQuote(from), shellQuote(to), shellQuote(tmp)
	if !overwrite {
		return fmt.Sprintf("if [ -e %[2]s ] || [ -L %[2]s ]; then exit %[3]d; fi; cp -a -- %[1]s %[2]s", f, t, exitExists)
	}
	// Copy beside the destination first so a failed copy never touches the existing item.
	return fmt.Sprintf("cp -a -- %[1]s %[3]s || { rm -rf -- %[3]s; exit 1; }; rm -rf -- %[2]s && mv -- %[3]s %[2]s || { rm -rf -- %[3]s; exit 1; }", f, t, x)
}

func moveCommand(from, to, tmp string, overwrite bool) string {
	f, t, x := shellQuote(from), shellQuote(to), shellQuote(tmp)
	if !overwrite {
		return fmt.Sprintf("if [ -e %[2]s ] || [ -L %[2]s ]; then exit %[3]d; fi; mv -- %[1]s %[2]s", f, t, exitExists)
	}
	// The temp name holds the only copy of the source, so on failure it goes back, never to rm.
	return fmt.Sprintf("mv -- %[1]s %[3]s || exit 1; if rm -rf -- %[2]s && mv -- %[3]s %[2]s; then exit 0; fi; mv -- %[3]s %[1]s; exit 1", f, t, x)
}

func compressCommand(dir string, names []string, archive, tmp, format string, overwrite bool) (string, error) {
	items := make([]string, len(names))
	for i, name := range names {
		items[i] = shellQuote("./" + name)
	}
	list := strings.Join(items, " ")
	a, x := shellQuote(archive), shellQuote(tmp)

	var create string
	switch format {
	case "zip":
		create = fmt.Sprintf("command -v zip >/dev/null 2>&1 || exit %d; zip -q -r -y %s %s", exitMissing, x, list)
	case "7z":
		create = fmt.Sprintf("Z=$(command -v 7z || command -v 7za) || exit %d; \"$Z\" a -t7z -bd -y %s %s >/dev/null", exitMissing, x, list)
	case "tar":
		create = fmt.Sprintf("tar -cf %s %s", x, list)
	case "tar.gz", "tgz":
		create = fmt.Sprintf("tar -czf %s %s", x, list)
	case "tar.bz2":
		create = fmt.Sprintf("tar -cjf %s %s", x, list)
	case "tar.xz":
		create = fmt.Sprintf("tar -cJf %s %s", x, list)
	default:
		return "", fmt.Errorf("unsupported archive format")
	}

	guard := ""
	if !overwrite {
		guard = fmt.Sprintf("if [ -e %[1]s ] || [ -L %[1]s ]; then exit %[2]d; fi; ", a, exitExists)
	}
	// Build into a hidden temp file so a failed run never leaves a half-written archive under the real name.
	return fmt.Sprintf("cd -- %s || exit 1; %s{ %s; } || { rc=$?; rm -f -- %s; exit $rc; }; mv -f -- %s %s",
		shellQuote(dir), guard, create, x, x, a), nil
}

// exec runs a shell command on the server without the 12s cap of Pool.Run: copies and archives
// can take minutes. It is bound to the request context instead.
func (s *Service) exec(ctx context.Context, serverID, command, tool string) error {
	if strings.TrimSpace(serverID) == "" {
		return fmt.Errorf("server id is required")
	}
	conn, err := s.pool.Ensure(serverID)
	if err != nil {
		return err
	}
	session, err := conn.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()
	var out bytes.Buffer
	session.Stdout = &out
	session.Stderr = &out

	done := make(chan error, 1)
	go func() { done <- session.Run(command) }()
	select {
	case err := <-done:
		return commandError(err, out.String(), tool)
	case <-ctx.Done():
		_ = session.Signal(ssh.SIGTERM)
		return fmt.Errorf("operation cancelled")
	}
}

func commandError(err error, output, tool string) error {
	if err == nil {
		return nil
	}
	var exit *ssh.ExitError
	if errors.As(err, &exit) {
		switch exit.ExitStatus() {
		case exitExists:
			return ErrExists
		case exitMissing:
			return fmt.Errorf("%s is not installed on the server", tool)
		}
	}
	lines := strings.Split(strings.TrimSpace(output), "\n")
	detail := strings.TrimSpace(lines[len(lines)-1])
	if detail == "" {
		return fmt.Errorf("filesystem operation failed")
	}
	if len(detail) > 240 {
		detail = detail[:240]
	}
	return &OpError{
		Message:    "operation failed: " + detail,
		Permission: strings.Contains(strings.ToLower(detail), "permission denied"),
	}
}

// OpError carries remote command output (which may mention paths like /etc/ssh), so the API
// must not run it through keyword-based error classification.
type OpError struct {
	Message    string
	Permission bool
}

func (e *OpError) Error() string { return e.Message }

func (s *Service) Copy(ctx context.Context, serverID, fromRaw, toRaw string, overwrite bool) error {
	from, to, err := transferPaths(fromRaw, toRaw)
	if err != nil {
		return err
	}
	return s.exec(ctx, serverID, copyCommand(from, to, tempName(to), overwrite), "cp")
}

func (s *Service) Move(ctx context.Context, serverID, fromRaw, toRaw string, overwrite bool) error {
	from, to, err := transferPaths(fromRaw, toRaw)
	if err != nil {
		return err
	}
	return s.exec(ctx, serverID, moveCommand(from, to, tempName(to), overwrite), "mv")
}

// Compress archives names (entries of dir) into dir/archive. It returns the archive path.
func (s *Service) Compress(ctx context.Context, serverID, dirRaw string, names []string, archive, format string, overwrite bool) (string, error) {
	ext, ok := ArchiveFormats[format]
	if !ok {
		return "", fmt.Errorf("unsupported archive format")
	}
	if len(names) == 0 {
		return "", fmt.Errorf("nothing to compress")
	}
	dir, err := CleanPath(dirRaw)
	if err != nil {
		return "", err
	}
	if !strings.HasSuffix(strings.ToLower(archive), ext) {
		archive += ext
	}
	archivePath, err := Join(dir, archive)
	if err != nil {
		return "", err
	}
	for _, name := range names {
		if _, err := Join(dir, name); err != nil {
			return "", err
		}
		if name == archive {
			return "", fmt.Errorf("archive name matches a selected item")
		}
	}
	tool := "tar"
	if format == "zip" || format == "7z" {
		tool = format
	}
	command, err := compressCommand(dir, names, archivePath, tempName(archivePath)+ext, format, overwrite)
	if err != nil {
		return "", err
	}
	if err := s.exec(ctx, serverID, command, tool); err != nil {
		return "", err
	}
	return archivePath, nil
}

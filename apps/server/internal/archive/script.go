package archive

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"serverui/server/internal/filesystem"
	sshx "serverui/server/internal/ssh"
)

// Policy decides what happens when an extracted top-level item already
// exists in the destination folder.
type Policy string

const (
	PolicyNone     Policy = ""
	PolicyReplace  Policy = "replace"
	PolicyKeepBoth Policy = "keep-both"
)

const (
	placedPrefix       = "@@placed "
	destinationChanged = "serverui: destination changed"
	// busyboxUnzip marks BusyBox's unzip, which cannot list archives in
	// enough detail to check them before extracting.
	busyboxUnzip = "busybox-unzip"
)

var (
	ErrNoSpace            = errors.New("not enough free disk space on the server to extract this archive")
	ErrDestinationChanged = errors.New("the destination changed during extraction; nothing was overwritten")
)

// MissingToolError means the server lacks the program needed for a format.
type MissingToolError struct {
	Tool    string
	Package string
}

func (e *MissingToolError) Error() string {
	return fmt.Sprintf("%s is not installed on the server. Install the %q package and try again", e.Tool, e.Package)
}

// CorruptError means the remote tool could not read the archive.
type CorruptError struct {
	Format Format
}

func (e *CorruptError) Error() string {
	return fmt.Sprintf("archive is corrupted or is not a valid %s archive", e.Format.label())
}

type toolset map[string]bool

// binary returns the program that handles format f on this server.
func (t toolset) binary(f Format) (string, error) {
	switch f {
	case FormatZip:
		if !t["unzip"] {
			return "", &MissingToolError{Tool: "unzip", Package: "unzip"}
		}
		if t[busyboxUnzip] {
			return "", &MissingToolError{Tool: "Info-ZIP unzip", Package: "unzip"}
		}
		return "unzip", nil
	case Format7z:
		for _, name := range []string{"7zz", "7z", "7za"} {
			if t[name] {
				return name, nil
			}
		}
		return "", &MissingToolError{Tool: "7z", Package: "p7zip-full"}
	}
	if !t["tar"] {
		return "", &MissingToolError{Tool: "tar", Package: "tar"}
	}
	switch f {
	case FormatTarGz:
		if !t["gzip"] {
			return "", &MissingToolError{Tool: "gzip", Package: "gzip"}
		}
	case FormatTarBz2:
		if !t["bzip2"] {
			return "", &MissingToolError{Tool: "bzip2", Package: "bzip2"}
		}
	case FormatTarXz:
		if !t["xz"] {
			return "", &MissingToolError{Tool: "xz", Package: "xz-utils"}
		}
	}
	return "tar", nil
}

func tarCompressionFlag(f Format) string {
	switch f {
	case FormatTarGz:
		return " -z"
	case FormatTarBz2:
		return " -j"
	case FormatTarXz:
		return " -J"
	}
	return ""
}

// preflight is what one round trip learns before listing the archive.
type preflight struct {
	tools   toolset
	archive string // ok, missing, notfile or denied
	freeKB  int64  // -1 when df is unavailable
}

// preflightCommand probes the installed tools, checks the archive, and
// reports free space on the filesystem that will hold dest (walking up to
// the nearest folder that already exists), as "@@key value" lines.
func preflightCommand(archive, dest string) string {
	return fmt.Sprintf(`for t in tar unzip 7zz 7z 7za gzip bzip2 xz; do command -v "$t" >/dev/null 2>&1 && echo "@@tool $t"; done
unzip 2>&1 | grep -q BusyBox && echo "@@tool %[3]s"
a=%[1]s
if [ ! -e "$a" ]; then s=missing; elif [ ! -f "$a" ]; then s=notfile; elif [ ! -r "$a" ]; then s=denied; else s=ok; fi
echo "@@archive $s"
d=%[2]s
while [ ! -d "$d" ]; do d=$(dirname "$d"); done
echo "@@free $(df -Pk "$d" 2>/dev/null | awk 'NR==2 {print $4}')"
exit 0`, ShellQuote(archive), ShellQuote(dest), busyboxUnzip)
}

func parsePreflight(out string) preflight {
	result := preflight{tools: toolset{}, freeKB: -1}
	for _, line := range strings.Split(out, "\n") {
		key, value, _ := strings.Cut(strings.TrimSpace(line), " ")
		switch key {
		case "@@tool":
			result.tools[value] = true
		case "@@archive":
			result.archive = value
		case "@@free":
			if kb, err := strconv.ParseInt(value, 10, 64); err == nil {
				result.freeKB = kb
			}
		}
	}
	return result
}

func listCommand(f Format, bin, archive string) string {
	switch f {
	case FormatZip:
		return "LC_ALL=C " + bin + " -Z -s " + ShellQuote(archive) + " </dev/null"
	case Format7z:
		return "LC_ALL=C " + bin + " l -slt -bd -- " + ShellQuote(archive) + " </dev/null"
	}
	return "LC_ALL=C tar -t -v" + tarCompressionFlag(f) + " -f " + ShellQuote(archive) + " </dev/null"
}

// extractCommand extracts into the staging folder held in $S.
func extractCommand(f Format, bin, archive string) string {
	switch f {
	case FormatZip:
		return bin + " -n " + ShellQuote(archive) + ` -d "$S/c" </dev/null`
	case Format7z:
		return bin + ` x -y -bd -bb1 -aos -o"$S/c" -- ` + ShellQuote(archive) + " </dev/null"
	}
	// -o: do not restore owners from the archive (matters when logged in as root).
	return "tar -x -v -o" + tarCompressionFlag(f) + " -f " + ShellQuote(archive) + ` -C "$S/c" </dev/null`
}

// isProgressLine reports whether a line of extractor output is one
// extracted member.
func isProgressLine(f Format, line string) bool {
	switch f {
	case FormatZip:
		trimmed := strings.TrimSpace(line)
		for _, verb := range []string{"inflating:", "extracting:", "creating:", "linking:"} {
			if strings.HasPrefix(trimmed, verb) {
				return true
			}
		}
		return false
	case Format7z:
		return strings.HasPrefix(line, "- ")
	}
	return strings.TrimSpace(line) != ""
}

type extractPlan struct {
	format     Format
	bin        string
	archive    string
	dest       string
	createDest bool
	// wrapName, when set, moves the whole extracted tree into dest/wrapName
	// instead of moving each top-level item into dest.
	wrapName string
	policy   Policy
}

// placeFunctions moves staged items into $D according to $P and prints
// "@@placed <name>" for each final name.
const placeFunctions = `unique() {
	n=$2
	case $n in
	?*.*) b=${n%.*}; e=.${n##*.} ;;
	*) b=$n; e= ;;
	esac
	i=1
	while [ -e "$1/$b ($i)$e" ] || [ -L "$1/$b ($i)$e" ]; do i=$((i + 1)); done
	printf '%s' "$b ($i)$e"
}
place() {
	t=$2
	if [ -e "$D/$t" ] || [ -L "$D/$t" ]; then
		case $P in
		replace) rm -rf -- "$D/$t" ;;
		keep-both) t=$(unique "$D" "$t") ;;
		*) echo "` + destinationChanged + `: $t" >&2; exit 4 ;;
		esac
	fi
	mv -- "$1" "$D/$t"
	printf '` + placedPrefix + `%s\n' "$t"
}
`

// script extracts into a private staging folder inside the destination, so
// a failure or cancel never leaves partial files behind, then moves the
// results into place.
func (p extractPlan) script() string {
	var b strings.Builder
	b.WriteString("set -eu\n")
	fmt.Fprintf(&b, "D=%s\n", ShellQuote(p.dest))
	fmt.Fprintf(&b, "P=%s\n", ShellQuote(string(p.policy)))
	if p.createDest {
		b.WriteString("mkdir -p -- \"$D\"\n")
	}
	b.WriteString("S=$(mktemp -d \"$D/.serverui-extract.XXXXXX\")\n")
	b.WriteString("trap 'rm -rf -- \"$S\"' EXIT\n")
	b.WriteString("trap 'exit 130' HUP INT TERM PIPE\n")
	b.WriteString("mkdir -- \"$S/c\"\n")
	b.WriteString(extractCommand(p.format, p.bin, p.archive) + "\n")
	b.WriteString(placeFunctions)
	if p.wrapName != "" {
		fmt.Fprintf(&b, "place \"$S/c\" %s\n", ShellQuote(p.wrapName))
		return b.String()
	}
	b.WriteString(`for f in "$S/c"/* "$S/c"/.[!.]* "$S/c"/..?*; do
	[ -e "$f" ] || [ -L "$f" ] || continue
	place "$f" "${f##*/}"
done
`)
	return b.String()
}

// exitStatuser matches *ssh.ExitError: the command ran and exited non-zero.
type exitStatuser interface {
	ExitStatus() int
}

// classify turns a failed remote command into a user-facing error.
func classify(f Format, stderr []byte, err error) error {
	var exited exitStatuser
	if !errors.As(err, &exited) && len(stderr) == 0 {
		return errors.New(sshx.PublicError(err))
	}
	msg := strings.ToLower(string(stderr))
	switch {
	case strings.Contains(msg, destinationChanged):
		return ErrDestinationChanged
	case strings.Contains(msg, "permission denied"), strings.Contains(msg, "operation not permitted"):
		return filesystem.ErrPermission
	case strings.Contains(msg, "no space left"), strings.Contains(msg, "disk quota exceeded"):
		return ErrNoSpace
	case strings.Contains(msg, "read-only file system"):
		return errors.New("the destination is on a read-only file system")
	case strings.Contains(msg, "password"), strings.Contains(msg, "encrypted"):
		return ErrEncrypted
	case strings.Contains(msg, "empty zipfile"), strings.Contains(msg, "zipfile is empty"):
		return ErrEmpty
	}
	for _, hint := range corruptHints {
		if strings.Contains(msg, hint) {
			return &CorruptError{Format: f}
		}
	}
	return errors.New("extraction failed on the server")
}

var corruptHints = []string{
	"corrupt", "not in gzip format", "not a bzip2 file", "format not recognized",
	"unrecognized archive", "does not look like a tar archive", "unexpected eof", "unexpected end",
	"end-of-central-directory", "zipfile directory", "bad zipfile", "as archive", "headers error",
	"data error", "crc failed", "truncated", "damaged",
}

type Format string

const (
	FormatTar    Format = "tar"
	FormatTarGz  Format = "tar.gz"
	FormatTarBz2 Format = "tar.bz2"
	FormatTarXz  Format = "tar.xz"
	FormatZip    Format = "zip"
	Format7z     Format = "7z"
)

// formatBySuffix maps the archive suffixes filesystem.ArchiveSuffix knows
// (shared with Compress) to the tool family that extracts them.
var formatBySuffix = map[string]Format{
	".tar.gz":  FormatTarGz,
	".tgz":     FormatTarGz,
	".tar.bz2": FormatTarBz2,
	".tbz2":    FormatTarBz2,
	".tar.xz":  FormatTarXz,
	".txz":     FormatTarXz,
	".tar":     FormatTar,
	".zip":     FormatZip,
	".7z":      Format7z,
}

// Detect returns the archive format implied by a file name.
func Detect(name string) (Format, bool) {
	format, ok := formatBySuffix[filesystem.ArchiveSuffix(name)]
	return format, ok
}

// Stem strips the archive suffix: "backup.tar.gz" becomes "backup".
func Stem(name string) string {
	return name[:len(name)-len(filesystem.ArchiveSuffix(name))]
}

// label is the user-facing format name used in error messages.
func (f Format) label() string {
	switch f {
	case FormatZip:
		return "ZIP"
	case Format7z:
		return "7z"
	default:
		return "tar"
	}
}

// ShellQuote wraps value in single quotes for POSIX sh, so it is always
// passed as one literal argument.
func ShellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}

package archive

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"path"
	"strings"
	"sync"
	"time"

	"serverui/server/internal/filesystem"
)

type State string

const (
	StateScanning         State = "scanning"
	StateAwaitingDecision State = "awaiting_decision"
	StateExtracting       State = "extracting"
	StateDone             State = "done"
	StateFailed           State = "failed"
	StateCancelled        State = "cancelled"
)

// Mode selects where extracted files go.
type Mode string

const (
	// ModeHere extracts next to the archive. Archives with several top-level
	// items are wrapped in a folder named after the archive.
	ModeHere Mode = "here"
	// ModeTo extracts the archive's top-level items into a chosen folder.
	ModeTo Mode = "to"
)

const (
	maxActiveJobsPerServer = 2
	decisionTimeout        = 10 * time.Minute
	finishedJobTTL         = 10 * time.Minute
)

var (
	ErrUnsupported = errors.New("unsupported archive format")
	ErrJobNotFound = errors.New("extraction job not found")
	ErrBusy        = errors.New("too many extractions are running on this server; wait for one to finish")
	errNotWaiting  = errors.New("extraction is not waiting for a decision")
	errBadPolicy   = errors.New("invalid conflict policy")
	errBadMode     = errors.New("invalid extract mode")
)

// Runner executes a shell command on a server, streaming stdout lines.
type Runner interface {
	Stream(ctx context.Context, serverID, command string, onLine func(string)) ([]byte, error)
}

// ListFunc lists a remote directory (filesystem.Service.List). It returns
// filesystem.ErrNotFound when the directory does not exist.
type ListFunc func(serverID, dir string) ([]filesystem.Entry, error)

// Job is the public snapshot of an extraction.
type Job struct {
	ID          string   `json:"id"`
	State       State    `json:"state"`
	Archive     string   `json:"archive"`
	Destination string   `json:"destination"`
	Done        int      `json:"done"`
	Total       int      `json:"total"`
	Conflicts   []string `json:"conflicts"`
	Extracted   []string `json:"extracted"`
	Error       string   `json:"error,omitempty"`
}

type job struct {
	Job
	serverID string
	format   Format
	mode     Mode
	cancel   context.CancelFunc
	decision chan Policy
	updated  time.Time
}

type Service struct {
	runner Runner
	list   ListFunc

	mu   sync.Mutex
	jobs map[string]*job
}

func New(runner Runner, list ListFunc) *Service {
	return &Service{runner: runner, list: list, jobs: map[string]*job{}}
}

// Start validates the request and begins extracting in the background.
func (s *Service) Start(serverID, rawArchive, rawDestination string, mode Mode) (Job, error) {
	archivePath, err := filesystem.CleanPath(rawArchive)
	if err != nil || archivePath == "/" {
		return Job{}, fmt.Errorf("invalid path")
	}
	format, ok := Detect(path.Base(archivePath))
	if !ok {
		return Job{}, ErrUnsupported
	}
	var destination string
	switch mode {
	case ModeHere:
		destination = path.Dir(archivePath)
	case ModeTo:
		if strings.TrimSpace(rawDestination) == "" {
			return Job{}, fmt.Errorf("destination is required")
		}
		if destination, err = filesystem.CleanPath(rawDestination); err != nil {
			return Job{}, err
		}
	default:
		return Job{}, errBadMode
	}

	id, err := newJobID()
	if err != nil {
		return Job{}, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	j := &job{
		Job: Job{
			ID:          id,
			State:       StateScanning,
			Archive:     archivePath,
			Destination: destination,
			Conflicts:   []string{},
			Extracted:   []string{},
		},
		serverID: serverID,
		format:   format,
		mode:     mode,
		cancel:   cancel,
		decision: make(chan Policy, 1),
		updated:  time.Now(),
	}

	s.mu.Lock()
	s.pruneLocked()
	if s.activeLocked(serverID) >= maxActiveJobsPerServer {
		s.mu.Unlock()
		cancel()
		return Job{}, ErrBusy
	}
	s.jobs[id] = j
	snapshot := j.snapshot()
	s.mu.Unlock()

	go s.run(ctx, j)
	return snapshot, nil
}

func (s *Service) Get(serverID, id string) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok || j.serverID != serverID {
		return Job{}, ErrJobNotFound
	}
	return j.snapshot(), nil
}

// Resolve answers a conflict prompt so extraction can continue.
func (s *Service) Resolve(serverID, id string, policy Policy) (Job, error) {
	if policy != PolicyReplace && policy != PolicyKeepBoth {
		return Job{}, errBadPolicy
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok || j.serverID != serverID {
		return Job{}, ErrJobNotFound
	}
	if j.State != StateAwaitingDecision {
		return Job{}, errNotWaiting
	}
	j.State = StateExtracting
	j.updated = time.Now()
	j.decision <- policy
	return j.snapshot(), nil
}

// Cancel stops a running extraction. The staging folder is removed on the
// server, so no partial output is left behind.
func (s *Service) Cancel(serverID, id string) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok || j.serverID != serverID {
		return Job{}, ErrJobNotFound
	}
	if !j.finished() {
		j.cancel()
	}
	return j.snapshot(), nil
}

func (s *Service) run(ctx context.Context, j *job) {
	defer j.cancel()
	extracted, err := s.extract(ctx, j)
	s.mu.Lock()
	defer s.mu.Unlock()
	j.updated = time.Now()
	switch {
	case ctx.Err() != nil:
		j.State = StateCancelled
	case err != nil:
		j.State = StateFailed
		j.Error = err.Error()
	default:
		j.State = StateDone
		j.Done = j.Total
		j.Extracted = extracted
	}
}

func (s *Service) extract(ctx context.Context, j *job) ([]string, error) {
	out, stderr, err := s.capture(ctx, j.serverID, preflightCommand(j.Archive, j.Destination))
	if err != nil {
		return nil, classify("", stderr, err)
	}
	pre := parsePreflight(out)
	bin, err := pre.tools.binary(j.format)
	if err != nil {
		return nil, err
	}
	switch pre.archive {
	case "ok":
	case "missing":
		return nil, filesystem.ErrNotFound
	case "denied":
		return nil, filesystem.ErrPermission
	default:
		return nil, fmt.Errorf("not a file")
	}

	listing, stderr, err := s.capture(ctx, j.serverID, listCommand(j.format, bin, j.Archive))
	if err != nil {
		// unzip reports archive errors on stdout, so classify both streams.
		return nil, classify(j.format, append(stderr, listing...), err)
	}
	entries, err := parse(j.format, listing)
	if err != nil {
		return nil, &CorruptError{Format: j.format}
	}
	summary, err := Inspect(entries)
	if err != nil {
		return nil, err
	}
	// df is best effort; extraction still fails cleanly if the disk fills.
	if pre.freeKB >= 0 && summary.TotalSize > pre.freeKB*1024 {
		return nil, ErrNoSpace
	}

	plan := extractPlan{format: j.format, bin: bin, archive: j.Archive, dest: j.Destination}
	targets := summary.TopLevel
	if j.mode == ModeHere && len(summary.TopLevel) > 1 {
		plan.wrapName = Stem(path.Base(j.Archive))
		targets = []string{plan.wrapName}
	}
	conflicts, exists, err := s.conflicts(j.serverID, j.Destination, targets)
	if err != nil {
		return nil, err
	}
	plan.createDest = !exists

	s.update(j, func() {
		j.Total = summary.Entries
		if len(conflicts) > 0 {
			j.State = StateAwaitingDecision
			j.Conflicts = conflicts
		} else {
			j.State = StateExtracting
		}
	})
	if len(conflicts) > 0 {
		if plan.policy, err = s.awaitDecision(ctx, j); err != nil {
			return nil, err
		}
	}

	var placed []string
	var other []string // non-progress stdout, kept for error classification
	stderr, err = s.runner.Stream(ctx, j.serverID, plan.script(), func(line string) {
		if name, ok := strings.CutPrefix(line, placedPrefix); ok {
			placed = append(placed, path.Join(j.Destination, name))
			return
		}
		if isProgressLine(j.format, line) {
			s.update(j, func() { j.Done = min(j.Done+1, j.Total) })
			return
		}
		if len(other) < 50 {
			other = append(other, line)
		}
	})
	if err != nil {
		return nil, classify(j.format, append(stderr, strings.Join(other, "\n")...), err)
	}
	return placed, nil
}

// conflicts returns the target names that already exist in dest, and
// whether dest exists at all.
func (s *Service) conflicts(serverID, dest string, targets []string) ([]string, bool, error) {
	entries, err := s.list(serverID, dest)
	if errors.Is(err, filesystem.ErrNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	existing := make(map[string]bool, len(entries))
	for _, entry := range entries {
		existing[entry.Name] = true
	}
	var found []string
	for _, name := range targets {
		if existing[name] {
			found = append(found, name)
		}
	}
	return found, true, nil
}

func (s *Service) awaitDecision(ctx context.Context, j *job) (Policy, error) {
	timer := time.NewTimer(decisionTimeout)
	defer timer.Stop()
	select {
	case policy := <-j.decision:
		return policy, nil
	case <-ctx.Done():
		return PolicyNone, ctx.Err()
	case <-timer.C:
		j.cancel()
		return PolicyNone, context.Canceled
	}
}

func (s *Service) capture(ctx context.Context, serverID, command string) (string, []byte, error) {
	var b strings.Builder
	stderr, err := s.runner.Stream(ctx, serverID, command, func(line string) {
		b.WriteString(line)
		b.WriteByte('\n')
	})
	return b.String(), stderr, err
}

func (s *Service) update(j *job, change func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	change()
	j.updated = time.Now()
}

func (s *Service) activeLocked(serverID string) int {
	count := 0
	for _, j := range s.jobs {
		if j.serverID == serverID && !j.finished() {
			count++
		}
	}
	return count
}

func (s *Service) pruneLocked() {
	cutoff := time.Now().Add(-finishedJobTTL)
	for id, j := range s.jobs {
		if j.finished() && j.updated.Before(cutoff) {
			delete(s.jobs, id)
		}
	}
}

func (j *job) finished() bool {
	switch j.State {
	case StateDone, StateFailed, StateCancelled:
		return true
	}
	return false
}

func (j *job) snapshot() Job {
	out := j.Job
	out.Conflicts = append([]string{}, j.Conflicts...)
	out.Extracted = append([]string{}, j.Extracted...)
	return out
}

func parse(f Format, listing string) ([]Entry, error) {
	switch f {
	case FormatZip:
		return ParseZipListing(listing)
	case Format7z:
		return Parse7zListing(listing)
	}
	return ParseTarListing(listing)
}

func newJobID() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

package metrics

import (
	"fmt"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Snapshot struct {
	Hostname             string         `json:"hostname"`
	CPUUsage             float64        `json:"cpuUsage"`
	CPUUser              float64        `json:"cpuUser"`
	CPUSystem            float64        `json:"cpuSystem"`
	CPUIowait            float64        `json:"cpuIowait"`
	CPUCores             int            `json:"cpuCores"`
	CPUPhysicalCores     int            `json:"cpuPhysicalCores"`
	CPUModel             string         `json:"cpuModel"`
	CPUBaseMHz           float64        `json:"cpuBaseMHz"`
	CPUMaxMHz            float64        `json:"cpuMaxMHz"`
	CPUTempC             float64        `json:"cpuTempC"`
	L1CacheBytes         int64          `json:"l1CacheBytes"`
	L2CacheBytes         int64          `json:"l2CacheBytes"`
	L3CacheBytes         int64          `json:"l3CacheBytes"`
	Cores                []CoreUsage    `json:"cores"`
	MemoryUsage          float64        `json:"memoryUsage"`
	MemoryUsedBytes      int64          `json:"memoryUsedBytes"`
	MemoryTotalBytes     int64          `json:"memoryTotalBytes"`
	MemoryAvailableBytes int64          `json:"memoryAvailableBytes"`
	MemoryCachedBytes    int64          `json:"memoryCachedBytes"`
	MemoryBuffersBytes   int64          `json:"memoryBuffersBytes"`
	SwapTotalBytes       int64          `json:"swapTotalBytes"`
	SwapUsedBytes        int64          `json:"swapUsedBytes"`
	SwapFreeBytes        int64          `json:"swapFreeBytes"`
	PageFaults           int64          `json:"pageFaults"`
	PageFaultsMinor      int64          `json:"pageFaultsMinor"`
	PageFaultsMajor      int64          `json:"pageFaultsMajor"`
	DiskUsage            float64        `json:"diskUsage"`
	DiskUsedBytes        int64          `json:"diskUsedBytes"`
	DiskTotalBytes       int64          `json:"diskTotalBytes"`
	DiskFreeBytes        int64          `json:"diskFreeBytes"`
	DiskReadBps          float64        `json:"diskReadBps"`
	DiskWriteBps         float64        `json:"diskWriteBps"`
	DiskReadIops         float64        `json:"diskReadIops"`
	DiskWriteIops        float64        `json:"diskWriteIops"`
	DiskDevice           string         `json:"diskDevice"`
	DiskModel            string         `json:"diskModel"`
	DiskType             string         `json:"diskType"`
	DiskFSType           string         `json:"diskFSType"`
	DiskMountOptions     string         `json:"diskMountOptions"`
	DiskTempC            float64        `json:"diskTempC"`
	DiskMounts           []DiskMount    `json:"diskMounts"`
	UptimeSeconds        int64          `json:"uptimeSeconds"`
	Load1                float64        `json:"load1"`
	Load5                float64        `json:"load5"`
	Load15               float64        `json:"load15"`
	OSName               string         `json:"osName"`
	Kernel               string         `json:"kernel"`
	Arch                 string         `json:"arch"`
	Virtualization       string         `json:"virtualization"`
	IPAddress            string         `json:"ipAddress"`
	DockerVersion        string         `json:"dockerVersion"`
	ContainerCount       int            `json:"containerCount"`
	NetRxBps             float64        `json:"netRxBps"`
	NetTxBps             float64        `json:"netTxBps"`
	NetRxBytes           int64          `json:"netRxBytes"`
	NetTxBytes           int64          `json:"netTxBytes"`
	NetConns             int            `json:"netConns"`
	NetEstablished       int            `json:"netEstablished"`
	NetListenPorts       []int          `json:"netListenPorts"`
	NetIface             string         `json:"netIface"`
	NetIfaceType         string         `json:"netIfaceType"`
	NetMAC               string         `json:"netMAC"`
	NetIPv4              string         `json:"netIPv4"`
	NetIPv6              string         `json:"netIPv6"`
	NetSubnet            string         `json:"netSubnet"`
	NetGateway           string         `json:"netGateway"`
	NetDNS               string         `json:"netDNS"`
	NetProcesses         []NetProcess   `json:"netProcesses"`
	ProcessCount         int            `json:"processCount"`
	ProcessUserCount     int            `json:"processUserCount"`
	ProcessSysCount      int            `json:"processSysCount"`
	ProcessRunning       int            `json:"processRunning"`
	Processes            []Process      `json:"processes"`
	ServiceRunning       int            `json:"serviceRunning"`
	ServiceStopped       int            `json:"serviceStopped"`
	ServiceFailed        int            `json:"serviceFailed"`
	ServiceOther         int            `json:"serviceOther"`
	Services             []Service      `json:"services"`
	History              []HistoryPoint `json:"history"`
}

type Process struct {
	PID            int     `json:"pid"`
	PPID           int     `json:"ppid"`
	Name           string  `json:"name"`
	User           string  `json:"user"`
	CPU            float64 `json:"cpu"`
	Memory         float64 `json:"memory"`
	MemoryBytes    int64   `json:"memoryBytes"`
	Threads        int     `json:"threads"`
	State          string  `json:"state"`
	ElapsedSeconds int64   `json:"elapsedSeconds"`
	Command        string  `json:"command"`
	Cwd            string  `json:"cwd"`
}

type Service struct {
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	State         string  `json:"state"`
	SubState      string  `json:"subState"`
	Type          string  `json:"type"`
	CPU           float64 `json:"cpu"`
	Memory        float64 `json:"memory"`
	MemoryBytes   int64   `json:"memoryBytes"`
	UptimeSeconds int64   `json:"uptimeSeconds"`
}

type NetProcess struct {
	PID         int     `json:"pid"`
	Name        string  `json:"name"`
	RxBps       float64 `json:"rxBps"`
	TxBps       float64 `json:"txBps"`
	Connections int     `json:"connections"`
}

type HistoryPoint struct {
	T                 int64     `json:"t"`
	CPU               float64   `json:"cpu"`
	CPUUser           float64   `json:"cpuUser"`
	CPUSystem         float64   `json:"cpuSystem"`
	CPUIowait         float64   `json:"cpuIowait"`
	Memory            float64   `json:"memory"`
	MemUsedBytes      int64     `json:"memUsedBytes"`
	MemCachedBytes    int64     `json:"memCachedBytes"`
	MemBuffersBytes   int64     `json:"memBuffersBytes"`
	MemAvailableBytes int64     `json:"memAvailableBytes"`
	Disk              float64   `json:"disk"`
	DiskReadBps       float64   `json:"diskReadBps"`
	DiskWriteBps      float64   `json:"diskWriteBps"`
	NetRx             float64   `json:"netRx"`
	NetTx             float64   `json:"netTx"`
	SvcRunning        float64   `json:"svcRunning"`
	SvcStopped        float64   `json:"svcStopped"`
	SvcFailed         float64   `json:"svcFailed"`
	SvcOther          float64   `json:"svcOther"`
	Cores             []float64 `json:"cores"`
}

type CoreUsage struct {
	ID    int     `json:"id"`
	Usage float64 `json:"usage"`
}

type cpuSample struct {
	user   uint64
	system uint64
	idle   uint64
	iowait uint64
	total  uint64
}

type netSample struct {
	rx uint64
	tx uint64
}

type diskSample struct {
	reads        uint64
	writes       uint64
	readSectors  uint64
	writeSectors uint64
}

type DiskMount struct {
	Device     string  `json:"device"`
	MountPoint string  `json:"mountPoint"`
	FSType     string  `json:"fsType"`
	UsedBytes  int64   `json:"usedBytes"`
	TotalBytes int64   `json:"totalBytes"`
	AvailBytes int64   `json:"availBytes"`
	Usage      float64 `json:"usage"`
}

type diskMeta struct {
	Name       string
	Rotational string
	Model      string
	SizeBytes  int64
}

func ParseHostname(raw string) string {
	return strings.TrimSpace(raw)
}

func ParseUptime(raw string) int64 {
	field := strings.Fields(strings.TrimSpace(raw))
	if len(field) == 0 {
		return 0
	}
	seconds, err := strconv.ParseFloat(field[0], 64)
	if err != nil {
		return 0
	}
	return int64(seconds)
}

type MemoryInfo struct {
	Total     int64
	Available int64
	Free      int64
	Cached    int64
	Buffers   int64
	SwapTotal int64
	SwapFree  int64
}

func (m MemoryInfo) Used() int64 {
	used := m.Total - m.Available
	if used < 0 {
		return 0
	}
	return used
}

func (m MemoryInfo) SwapUsed() int64 {
	used := m.SwapTotal - m.SwapFree
	if used < 0 {
		return 0
	}
	return used
}

func ParseMemory(raw string) float64 {
	used, total := ParseMemoryBytes(raw)
	if total <= 0 {
		return 0
	}
	return round1((float64(used) / float64(total)) * 100)
}

func ParseMemoryBytes(raw string) (used, total int64) {
	info := ParseMemoryInfo(raw)
	return info.Used(), info.Total
}

func ParseMemoryInfo(raw string) MemoryInfo {
	var info MemoryInfo
	var sreclaim int64
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		value, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			continue
		}
		value *= 1024
		switch fields[0] {
		case "MemTotal:":
			info.Total = value
		case "MemAvailable:":
			info.Available = value
		case "MemFree:":
			info.Free = value
		case "Cached:":
			info.Cached = value
		case "Buffers:":
			info.Buffers = value
		case "SReclaimable:":
			sreclaim = value
		case "SwapTotal:":
			info.SwapTotal = value
		case "SwapFree:":
			info.SwapFree = value
		}
	}
	if info.Cached == 0 && sreclaim > 0 {
		info.Cached = sreclaim
	}
	if info.Available == 0 && info.Total > 0 {
		info.Available = info.Free + info.Buffers + info.Cached
		if info.Available > info.Total {
			info.Available = info.Total
		}
	}
	return info
}

func ParseVmstat(raw string) (faults, major int64) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		value, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			continue
		}
		switch fields[0] {
		case "pgfault":
			faults = value
		case "pgmajfault":
			major = value
		}
	}
	return faults, major
}

func ParseDisk(raw string) float64 {
	_, _, percent := ParseDiskBytes(raw)
	return percent
}

func ParseDiskBytes(raw string) (used, total int64, percent float64) {
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	if len(lines) < 2 {
		return 0, 0, 0
	}
	fields := strings.Fields(lines[len(lines)-1])
	if len(fields) < 5 {
		return 0, 0, 0
	}
	total, _ = strconv.ParseInt(fields[1], 10, 64)
	used, _ = strconv.ParseInt(fields[2], 10, 64)
	pct := strings.TrimSuffix(fields[4], "%")
	percent, _ = strconv.ParseFloat(pct, 64)
	if percent == 0 && total > 0 {
		percent = round1((float64(used) / float64(total)) * 100)
	}
	return used, total, round1(percent)
}

func ParseMounts(raw string) []DiskMount {
	out := make([]DiskMount, 0, 8)
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 6 {
			continue
		}
		if strings.EqualFold(fields[0], "Filesystem") {
			continue
		}
		fs := strings.ToLower(fields[0])
		mount := strings.Join(fields[5:], " ")
		if skipMount(fs, mount) {
			continue
		}
		total, _ := strconv.ParseInt(fields[1], 10, 64)
		used, _ := strconv.ParseInt(fields[2], 10, 64)
		avail, _ := strconv.ParseInt(fields[3], 10, 64)
		if total <= 0 {
			continue
		}
		pct, _ := strconv.ParseFloat(strings.TrimSuffix(fields[4], "%"), 64)
		if pct == 0 {
			pct = (float64(used) / float64(total)) * 100
		}
		out = append(out, DiskMount{
			Device:     fields[0],
			MountPoint: mount,
			UsedBytes:  used,
			TotalBytes: total,
			AvailBytes: avail,
			Usage:      round1(pct),
		})
		if len(out) >= 12 {
			break
		}
	}
	return out
}

func skipMount(fs, mount string) bool {
	for _, prefix := range []string{"tmpfs", "devtmpfs", "squashfs", "overlay", "udev", "none", "efivarfs", "cgroup", "proc", "sysfs"} {
		if strings.Contains(fs, prefix) {
			return true
		}
	}
	for _, prefix := range []string{"/dev", "/run", "/sys", "/proc", "/snap"} {
		if mount == prefix || strings.HasPrefix(mount, prefix+"/") {
			return true
		}
	}
	return false
}

func ParseProcMounts(raw string) map[string]struct {
	Source string
	FSType string
	Opts   string
} {
	out := map[string]struct {
		Source string
		FSType string
		Opts   string
	}{}
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 4 {
			continue
		}
		out[fields[1]] = struct {
			Source string
			FSType string
			Opts   string
		}{Source: fields[0], FSType: fields[2], Opts: fields[3]}
	}
	return out
}

func EnrichMounts(mounts []DiskMount, procMounts string) []DiskMount {
	info := ParseProcMounts(procMounts)
	for i := range mounts {
		entry, ok := info[mounts[i].MountPoint]
		if !ok {
			continue
		}
		mounts[i].FSType = entry.FSType
		if mounts[i].Device == "" {
			mounts[i].Device = entry.Source
		}
	}
	return mounts
}

func ParentBlockDevice(dev string) string {
	name := path.Base(strings.TrimSpace(dev))
	if name == "." || name == "/" {
		return ""
	}
	if strings.HasPrefix(name, "nvme") || strings.HasPrefix(name, "mmcblk") {
		if idx := strings.LastIndex(name, "p"); idx > 0 {
			if _, err := strconv.Atoi(name[idx+1:]); err == nil {
				return name[:idx]
			}
		}
		return name
	}
	i := len(name)
	for i > 0 && name[i-1] >= '0' && name[i-1] <= '9' {
		i--
	}
	if i > 0 && i < len(name) {
		return name[:i]
	}
	return name
}

func ParseDiskMeta(raw string) map[string]diskMeta {
	out := map[string]diskMeta{}
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Split(strings.TrimSpace(line), "\t")
		if len(fields) < 4 {
			continue
		}
		sectors, _ := strconv.ParseInt(fields[3], 10, 64)
		out[fields[0]] = diskMeta{
			Name:       fields[0],
			Rotational: fields[1],
			Model:      strings.TrimSpace(fields[2]),
			SizeBytes:  sectors * 512,
		}
	}
	return out
}

func DiskKind(name, rotational string) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "nvme") {
		return "NVMe SSD"
	}
	if rotational == "0" {
		return "SSD"
	}
	if rotational == "1" {
		return "HDD"
	}
	return "Disk"
}

func ParseDiskStats(raw string) diskSample {
	var sample diskSample
	matched := 0
	var fallback diskSample
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 14 {
			continue
		}
		name := fields[2]
		reads, _ := strconv.ParseUint(fields[3], 10, 64)
		readSec, _ := strconv.ParseUint(fields[5], 10, 64)
		writes, _ := strconv.ParseUint(fields[7], 10, 64)
		writeSec, _ := strconv.ParseUint(fields[9], 10, 64)
		if !skipDiskName(name) {
			fallback.reads += reads
			fallback.readSectors += readSec
			fallback.writes += writes
			fallback.writeSectors += writeSec
		}
		if !isWholeDisk(name) {
			continue
		}
		sample.reads += reads
		sample.readSectors += readSec
		sample.writes += writes
		sample.writeSectors += writeSec
		matched++
	}
	if matched == 0 {
		return fallback
	}
	return sample
}

func skipDiskName(name string) bool {
	for _, prefix := range []string{"loop", "ram", "sr", "fd", "zram"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func isWholeDisk(name string) bool {
	if skipDiskName(name) || strings.HasPrefix(name, "dm-") || strings.HasPrefix(name, "md") {
		return false
	}
	if strings.HasPrefix(name, "nvme") || strings.HasPrefix(name, "mmcblk") {
		return !strings.Contains(name, "p")
	}
	if name == "" {
		return false
	}
	last := name[len(name)-1]
	return last < '0' || last > '9'
}

func DiskRate(prev, next diskSample, elapsed float64) (readBps, writeBps, readIops, writeIops float64) {
	if elapsed <= 0 || next.readSectors < prev.readSectors {
		return 0, 0, 0, 0
	}
	const sector = 512.0
	readBps = float64(next.readSectors-prev.readSectors) * sector / elapsed
	writeBps = float64(next.writeSectors-prev.writeSectors) * sector / elapsed
	readIops = float64(next.reads-prev.reads) / elapsed
	writeIops = float64(next.writes-prev.writes) / elapsed
	return round1(readBps), round1(writeBps), round1(readIops), round1(writeIops)
}

func ParseDiskTemp(raw string) float64 {
	best := 0.0
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		milli, err := strconv.ParseFloat(fields[len(fields)-1], 64)
		if err != nil {
			continue
		}
		temp := milli
		if milli > 200 {
			temp = milli / 1000
		}
		if temp > best {
			best = temp
		}
	}
	if best == 0 {
		return 0
	}
	return round1(best)
}

func parseCPUSample(fields []string) cpuSample {
	var sample cpuSample
	for i, field := range fields {
		n, _ := strconv.ParseUint(field, 10, 64)
		sample.total += n
		switch i {
		case 0, 1:
			sample.user += n
		case 2, 5, 6:
			sample.system += n
		case 3:
			sample.idle += n
		case 4:
			sample.iowait += n
		}
	}
	return sample
}

func ParseCPUStat(raw string) cpuSample {
	for _, line := range strings.Split(raw, "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		return parseCPUSample(fields[1:])
	}
	return cpuSample{}
}

func ParseCPUCoreStats(raw string) []cpuSample {
	out := make([]cpuSample, 0, 8)
	for _, line := range strings.Split(raw, "\n") {
		if !strings.HasPrefix(line, "cpu") || strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		out = append(out, parseCPUSample(fields[1:]))
	}
	return out
}

func CPUPercent(prev, next cpuSample) float64 {
	total, _, _, _ := CPUBreakdown(prev, next)
	return total
}

func CPUBreakdown(prev, next cpuSample) (total, user, system, iowait float64) {
	if prev.total == 0 || next.total <= prev.total {
		return 0, 0, 0, 0
	}
	delta := float64(next.total - prev.total)
	idleDelta := float64((next.idle + next.iowait) - (prev.idle + prev.iowait))
	used := delta - idleDelta
	if used < 0 {
		used = 0
	}
	total = round1((used / delta) * 100)
	user = round1(float64(next.user-prev.user) / delta * 100)
	system = round1(float64(next.system-prev.system) / delta * 100)
	iowait = round1(float64(next.iowait-prev.iowait) / delta * 100)
	return total, user, system, iowait
}

func CorePercents(prev, next []cpuSample) []CoreUsage {
	n := len(next)
	if len(prev) < n {
		n = len(prev)
	}
	out := make([]CoreUsage, 0, len(next))
	for i, sample := range next {
		usage := 0.0
		if i < n {
			usage = CPUPercent(prev[i], sample)
		}
		out = append(out, CoreUsage{ID: i, Usage: usage})
	}
	return out
}

func ParseCPUInfo(raw string) (cores int, model string) {
	info := ParseCPUIdentity(raw)
	return info.Logical, info.Model
}

type CPUIdentity struct {
	Model    string
	Logical  int
	Physical int
	MHz      float64
}

func ParseCPUIdentity(raw string) CPUIdentity {
	info := CPUIdentity{}
	physicalIDs := map[string]struct{}{}
	cpuCores := 0
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if info.Logical == 0 {
			if n, err := strconv.Atoi(line); err == nil {
				info.Logical = n
				continue
			}
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		switch key {
		case "processor":
			info.Logical++
		case "model name", "Hardware":
			if info.Model == "" {
				info.Model = value
			}
		case "cpu cores":
			n, _ := strconv.Atoi(value)
			if n > cpuCores {
				cpuCores = n
			}
		case "physical id":
			physicalIDs[value] = struct{}{}
		case "cpu MHz":
			mhz, _ := strconv.ParseFloat(value, 64)
			if mhz > info.MHz {
				info.MHz = mhz
			}
		}
	}
	sockets := len(physicalIDs)
	if sockets == 0 {
		sockets = 1
	}
	if cpuCores > 0 {
		info.Physical = cpuCores * sockets
	}
	if info.Physical == 0 {
		info.Physical = info.Logical
	}
	return info
}

func ParseCPUFreq(raw string) (baseMHz, maxMHz, curMHz float64) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		value := freqToMHz(fields[1])
		switch fields[0] {
		case "base":
			baseMHz = value
		case "max":
			maxMHz = value
		case "cur":
			curMHz = value
		}
	}
	return baseMHz, maxMHz, curMHz
}

func freqToMHz(raw string) float64 {
	n, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || n <= 0 {
		return 0
	}
	if n > 10000 {
		return n / 1000
	}
	return n
}

func ParseThermal(raw string) float64 {
	best := 0.0
	preferred := 0.0
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		milli, err := strconv.ParseFloat(fields[len(fields)-1], 64)
		if err != nil || milli <= 0 {
			continue
		}
		c := milli
		if milli > 200 {
			c = milli / 1000
		}
		if best == 0 {
			best = c
		}
		kind := strings.ToLower(fields[0])
		if strings.Contains(kind, "pkg") || strings.Contains(kind, "x86") || strings.Contains(kind, "cpu") {
			preferred = c
		}
	}
	if preferred > 0 {
		return round1(preferred)
	}
	return round1(best)
}

func ParseCacheBytes(raw string) (l1, l2, l3 int64) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 3 {
			continue
		}
		level, err := strconv.Atoi(fields[1])
		if err != nil {
			continue
		}
		size := parseCacheSize(fields[len(fields)-1])
		switch level {
		case 1:
			l1 += size
		case 2:
			if size > l2 {
				l2 = size
			}
		case 3:
			if size > l3 {
				l3 = size
			}
		}
	}
	return l1, l2, l3
}

func parseCacheSize(raw string) int64 {
	s := strings.TrimSpace(strings.ToUpper(raw))
	mult := int64(1024)
	switch {
	case strings.HasSuffix(s, "K"):
		s = strings.TrimSuffix(s, "K")
	case strings.HasSuffix(s, "KB"):
		s = strings.TrimSuffix(s, "KB")
	case strings.HasSuffix(s, "M"):
		s = strings.TrimSuffix(s, "M")
		mult = 1024 * 1024
	case strings.HasSuffix(s, "MB"):
		s = strings.TrimSuffix(s, "MB")
		mult = 1024 * 1024
	}
	n, _ := strconv.ParseInt(s, 10, 64)
	return n * mult
}

func ParseLoad(raw string) (l1, l5, l15 float64) {
	fields := strings.Fields(strings.TrimSpace(raw))
	if len(fields) < 3 {
		return 0, 0, 0
	}
	l1, _ = strconv.ParseFloat(fields[0], 64)
	l5, _ = strconv.ParseFloat(fields[1], 64)
	l15, _ = strconv.ParseFloat(fields[2], 64)
	return round2(l1), round2(l5), round2(l15)
}

func ParseOSRelease(raw string) string {
	pretty := ""
	name := ""
	for _, line := range strings.Split(raw, "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		switch key {
		case "PRETTY_NAME":
			pretty = value
		case "NAME":
			name = value
		}
	}
	if pretty != "" {
		return pretty
	}
	return name
}

func ParseUname(raw string) (kernel, arch string) {
	fields := strings.Fields(strings.TrimSpace(raw))
	// uname -srm => Linux 6.5.0-27-generic x86_64
	if len(fields) >= 3 {
		return fields[1], fields[2]
	}
	if len(fields) == 2 {
		return fields[0], fields[1]
	}
	return strings.TrimSpace(raw), ""
}

func ParseNetDev(raw string) netSample {
	var sample netSample
	for _, line := range strings.Split(raw, "\n") {
		iface, rest, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name := strings.TrimSpace(iface)
		if name == "" || name == "lo" {
			continue
		}
		fields := strings.Fields(rest)
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseUint(fields[0], 10, 64)
		tx, _ := strconv.ParseUint(fields[8], 10, 64)
		sample.rx += rx
		sample.tx += tx
	}
	return sample
}

func NetRate(prev, next netSample, elapsed float64) (rxBps, txBps float64) {
	if elapsed <= 0 || next.rx < prev.rx {
		return 0, 0
	}
	rxBps = float64(next.rx-prev.rx) / elapsed
	txBps = float64(next.tx-prev.tx) / elapsed
	return rxBps, txBps
}

func ParsePrimaryIface(raw string) string {
	best, bestBytes := "", uint64(0)
	for _, line := range strings.Split(raw, "\n") {
		iface, rest, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name := strings.TrimSpace(iface)
		if name == "" || name == "lo" || strings.Contains(name, " ") {
			continue
		}
		fields := strings.Fields(rest)
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseUint(fields[0], 10, 64)
		tx, _ := strconv.ParseUint(fields[8], 10, 64)
		if rx+tx >= bestBytes {
			bestBytes = rx + tx
			best = name
		}
	}
	return best
}

func ParseDefaultRoute(raw string) (gateway, iface string) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 3 || fields[0] != "default" {
			continue
		}
		for i, field := range fields {
			if field == "via" && i+1 < len(fields) {
				gateway = fields[i+1]
			}
			if field == "dev" && i+1 < len(fields) {
				iface = fields[i+1]
			}
		}
		if iface != "" || gateway != "" {
			return gateway, iface
		}
	}
	return "", ""
}

func ParseIPv4(raw, iface string) (ip string, prefix int) {
	fallbackIP, fallbackPrefix := "", 0
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 4 {
			continue
		}
		name := strings.TrimSuffix(fields[1], ":")
		cidr := ""
		for i, field := range fields {
			if field == "inet" && i+1 < len(fields) {
				cidr = fields[i+1]
				break
			}
		}
		host, bits := splitCIDR(cidr)
		if host == "" {
			continue
		}
		if fallbackIP == "" && name != "lo" {
			fallbackIP, fallbackPrefix = host, bits
		}
		if iface != "" && name == iface {
			return host, bits
		}
	}
	return fallbackIP, fallbackPrefix
}

func ParseIPv6(raw, iface string) string {
	fallback := ""
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 4 {
			continue
		}
		name := strings.TrimSuffix(fields[1], ":")
		host := ""
		for i, field := range fields {
			if field == "inet6" && i+1 < len(fields) {
				host, _ = splitCIDR(fields[i+1])
				break
			}
		}
		if host == "" || strings.HasPrefix(strings.ToLower(host), "fe80:") {
			continue
		}
		if fallback == "" && name != "lo" {
			fallback = host
		}
		if iface != "" && name == iface {
			return host
		}
	}
	return fallback
}

func splitCIDR(cidr string) (string, int) {
	host, bits, ok := strings.Cut(strings.TrimSpace(cidr), "/")
	if !ok {
		return strings.TrimSpace(cidr), 0
	}
	n, _ := strconv.Atoi(bits)
	return host, n
}

func IPv4Mask(bits int) string {
	if bits <= 0 || bits > 32 {
		return ""
	}
	mask := uint32(0xffffffff) << (32 - bits)
	return fmt.Sprintf("%d.%d.%d.%d", byte(mask>>24), byte(mask>>16), byte(mask>>8), byte(mask))
}

func ParseLinkMAC(raw, iface string) string {
	fallback := ""
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		name := strings.TrimSuffix(fields[1], ":")
		mac := ""
		for i, field := range fields {
			if (field == "link/ether" || field == "link/loopback") && i+1 < len(fields) {
				mac = fields[i+1]
				break
			}
		}
		if mac == "" || mac == "00:00:00:00:00:00" {
			continue
		}
		if fallback == "" && name != "lo" {
			fallback = mac
		}
		if iface != "" && name == iface {
			return mac
		}
	}
	return fallback
}

func ParseIfaceMeta(raw, iface string) (kind, mac string) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Split(strings.TrimSpace(line), "\t")
		if len(fields) < 4 {
			continue
		}
		if iface != "" && fields[0] != iface {
			continue
		}
		if fields[0] == "lo" {
			continue
		}
		wifi := "0"
		if len(fields) > 3 && (fields[3] == "1" || fields[3] == "true") {
			wifi = "1"
		}
		return ifaceKind(fields[0], fields[1], wifi), fields[2]
	}
	return "", ""
}

func ifaceKind(name, typeCode, wifi string) string {
	lower := strings.ToLower(name)
	if wifi == "1" || strings.HasPrefix(lower, "wl") || strings.HasPrefix(lower, "wlan") {
		return "Wi-Fi"
	}
	if strings.HasPrefix(lower, "wg") || strings.HasPrefix(lower, "tun") || strings.HasPrefix(lower, "tap") {
		return "VPN"
	}
	if strings.HasPrefix(lower, "br") || strings.HasPrefix(lower, "docker") || strings.HasPrefix(lower, "veth") || strings.HasPrefix(lower, "virbr") {
		return "Bridge"
	}
	if typeCode == "1" {
		return "Ethernet"
	}
	return "Ethernet"
}

func ParseDNS(raw string) string {
	out := make([]string, 0, 3)
	seen := map[string]bool{}
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 || fields[0] != "nameserver" {
			continue
		}
		if seen[fields[1]] {
			continue
		}
		seen[fields[1]] = true
		out = append(out, fields[1])
	}
	return strings.Join(out, ", ")
}

func ParseTCPStats(raw string) (active, established int, listenPorts []int) {
	seen := map[int]bool{}
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 4 || fields[0] == "sl" {
			continue
		}
		st := strings.ToLower(fields[3])
		port := parseHexPort(fields[1])
		if st == "0a" {
			if port > 0 && !seen[port] {
				seen[port] = true
				listenPorts = append(listenPorts, port)
			}
			continue
		}
		active++
		if st == "01" {
			established++
		}
	}
	sort.Ints(listenPorts)
	if len(listenPorts) > 12 {
		listenPorts = listenPorts[:12]
	}
	return active, established, listenPorts
}

func parseHexPort(addr string) int {
	_, port, ok := strings.Cut(addr, ":")
	if !ok {
		return 0
	}
	n, err := strconv.ParseInt(port, 16, 64)
	if err != nil {
		return 0
	}
	return int(n)
}

var ssUserRe = regexp.MustCompile(`users:\(\("([^"]+)",pid=(\d+)`)

func ParseSSProcesses(raw string, rxBps, txBps float64) []NetProcess {
	type agg struct {
		name  string
		conns int
	}
	byPID := map[int]*agg{}
	for _, line := range strings.Split(raw, "\n") {
		if strings.Contains(strings.ToUpper(line), "LISTEN") {
			continue
		}
		match := ssUserRe.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		pid, _ := strconv.Atoi(match[2])
		if pid == 0 {
			continue
		}
		item, ok := byPID[pid]
		if !ok {
			item = &agg{name: match[1]}
			byPID[pid] = item
		}
		item.conns++
	}
	total := 0
	out := make([]NetProcess, 0, len(byPID))
	for pid, item := range byPID {
		total += item.conns
		out = append(out, NetProcess{PID: pid, Name: item.name, Connections: item.conns})
	}
	if total == 0 {
		return out
	}
	for i := range out {
		share := float64(out[i].Connections) / float64(total)
		out[i].RxBps = round1(rxBps * share)
		out[i].TxBps = round1(txBps * share)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].RxBps+out[i].TxBps > out[j].RxBps+out[j].TxBps
	})
	if len(out) > 8 {
		out = out[:8]
	}
	return out
}

func ParseProcesses(raw string) []Process {
	out := make([]Process, 0, 24)
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 5 {
			continue
		}
		if strings.EqualFold(fields[0], "PID") {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil {
			continue
		}
		proc := Process{PID: pid, Threads: 1}
		if len(fields) >= 10 {
			proc.PPID, _ = strconv.Atoi(fields[1])
			proc.Threads, _ = strconv.Atoi(fields[2])
			proc.User = fields[3]
			proc.CPU, _ = strconv.ParseFloat(fields[4], 64)
			proc.Memory, _ = strconv.ParseFloat(fields[5], 64)
			rss, _ := strconv.ParseInt(fields[6], 10, 64)
			proc.MemoryBytes = rss * 1024
			proc.ElapsedSeconds, _ = strconv.ParseInt(fields[7], 10, 64)
			proc.State = fields[8]
			proc.Name = fields[9]
		} else {
			proc.CPU, _ = strconv.ParseFloat(fields[1], 64)
			proc.Memory, _ = strconv.ParseFloat(fields[2], 64)
			rss, _ := strconv.ParseInt(fields[3], 10, 64)
			proc.MemoryBytes = rss * 1024
			proc.Name = fields[4]
		}
		if proc.Threads <= 0 {
			proc.Threads = 1
		}
		if i := strings.LastIndex(proc.Name, "/"); i >= 0 && i < len(proc.Name)-1 {
			proc.Name = proc.Name[i+1:]
		}
		proc.CPU = round1(proc.CPU)
		proc.Memory = round1(proc.Memory)
		out = append(out, proc)
		if len(out) >= 24 {
			break
		}
	}
	return out
}

func ParseProcessCounts(raw string) (total, user, system, running int) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}
		n, _ := strconv.Atoi(fields[1])
		switch fields[0] {
		case "total":
			total = n
		case "user":
			user = n
		case "system":
			system = n
		case "running":
			running = n
		}
	}
	return total, user, system, running
}

func EnrichProcessMeta(procs []Process, raw string) []Process {
	meta := map[int][2]string{}
	for _, line := range strings.Split(raw, "\n") {
		parts := strings.SplitN(strings.TrimSpace(line), "\t", 3)
		if len(parts) < 2 {
			continue
		}
		pid, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			continue
		}
		cmd := strings.TrimSpace(parts[1])
		cwd := ""
		if len(parts) > 2 {
			cwd = strings.TrimSpace(parts[2])
		}
		meta[pid] = [2]string{cmd, cwd}
	}
	for i := range procs {
		entry, ok := meta[procs[i].PID]
		if !ok {
			continue
		}
		procs[i].Command = entry[0]
		procs[i].Cwd = entry[1]
	}
	return procs
}

type ProcessInspect struct {
	Command   string   `json:"command"`
	Cwd       string   `json:"cwd"`
	Environ   []string `json:"environ"`
	OpenFiles []string `json:"openFiles"`
	Sockets   []string `json:"sockets"`
}

func ParseProcessInspect(raw string) ProcessInspect {
	sections := SplitSections(raw)
	env := make([]string, 0, 16)
	for _, line := range strings.Split(sections["ENV"], "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		env = append(env, redactEnv(line))
		if len(env) >= 40 {
			break
		}
	}
	files := make([]string, 0, 16)
	for _, line := range strings.Split(sections["FD"], "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "total") {
			continue
		}
		if i := strings.Index(line, " -> "); i >= 0 {
			files = append(files, strings.TrimSpace(line[i+4:]))
		} else {
			files = append(files, line)
		}
		if len(files) >= 40 {
			break
		}
	}
	socks := make([]string, 0, 8)
	for _, line := range strings.Split(sections["SOCK"], "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Netid") {
			continue
		}
		socks = append(socks, line)
		if len(socks) >= 16 {
			break
		}
	}
	return ProcessInspect{
		Command:   strings.TrimSpace(sections["CMD"]),
		Cwd:       strings.TrimSpace(sections["CWD"]),
		Environ:   env,
		OpenFiles: files,
		Sockets:   socks,
	}
}

func redactEnv(line string) string {
	key, _, ok := strings.Cut(line, "=")
	if !ok {
		return line
	}
	lower := strings.ToLower(key)
	for _, needle := range []string{"pass", "secret", "token", "key", "credential", "auth"} {
		if strings.Contains(lower, needle) {
			return key + "=••••"
		}
	}
	return line
}

func ParseServices(raw string) []Service {
	out := make([]Service, 0, 48)
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) == 0 {
			continue
		}
		unit := fields[0]
		if strings.HasPrefix(unit, "●") {
			if len(fields) < 2 {
				continue
			}
			unit = fields[1]
			fields = fields[1:]
		}
		name := strings.TrimSuffix(unit, ".service")
		if name == "" || strings.EqualFold(name, "UNIT") {
			continue
		}
		active, sub, desc := "", "", ""
		if len(fields) >= 4 {
			active = strings.ToLower(fields[2])
			sub = strings.ToLower(fields[3])
			if len(fields) > 4 {
				desc = strings.Join(fields[4:], " ")
			}
		} else {
			for _, field := range fields {
				if field == "running" || field == "exited" || field == "failed" || field == "dead" {
					sub = field
					break
				}
			}
		}
		state := NormalizeServiceState(active, sub)
		out = append(out, Service{
			Name:        name,
			Description: desc,
			State:       state,
			SubState:    sub,
			Type:        "system",
		})
		if len(out) >= 80 {
			break
		}
	}
	return out
}

func NormalizeServiceState(active, sub string) string {
	a := strings.ToLower(active)
	s := strings.ToLower(sub)
	if a == "failed" || s == "failed" {
		return "failed"
	}
	if s == "running" {
		return "running"
	}
	if a == "inactive" || s == "dead" || s == "exited" || s == "stopped" {
		return "stopped"
	}
	if a == "" && s == "" {
		return "running"
	}
	return "other"
}

func ServiceCounts(svcs []Service) (running, stopped, failed, other int) {
	for _, svc := range svcs {
		switch svc.State {
		case "running":
			running++
		case "stopped":
			stopped++
		case "failed":
			failed++
		default:
			other++
		}
	}
	return running, stopped, failed, other
}

func EnrichServices(svcs []Service, procs []Process) []Service {
	index := map[string]Process{}
	for _, proc := range procs {
		index[strings.ToLower(proc.Name)] = proc
	}
	for i, svc := range svcs {
		for _, alias := range serviceAliases(svc.Name) {
			proc, ok := index[alias]
			if !ok {
				continue
			}
			svcs[i].CPU = proc.CPU
			svcs[i].Memory = proc.Memory
			svcs[i].MemoryBytes = proc.MemoryBytes
			svcs[i].UptimeSeconds = proc.ElapsedSeconds
			break
		}
	}
	return svcs
}

func serviceAliases(name string) []string {
	n := strings.ToLower(strings.TrimSuffix(name, ".service"))
	extra := map[string][]string{
		"ssh":        {"sshd", "ssh"},
		"sshd":       {"sshd", "ssh"},
		"postgresql": {"postgres", "postgresql"},
		"redis":      {"redis-server", "redis"},
		"docker":     {"dockerd", "docker"},
		"fail2ban":   {"fail2ban-server", "fail2ban"},
	}
	out := []string{n}
	out = append(out, extra[n]...)
	return out
}

func SanitizeUnit(name string) (string, error) {
	name = strings.TrimSpace(name)
	name = strings.TrimSuffix(name, ".service")
	if name == "" || len(name) > 128 {
		return "", fmt.Errorf("invalid unit")
	}
	for i := 0; i < len(name); i++ {
		c := name[i]
		ok := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '@' || c == ':'
		if !ok {
			return "", fmt.Errorf("invalid unit")
		}
	}
	return name + ".service", nil
}

func ParseFirstIP(raw string) string {
	for _, line := range strings.Split(raw, "\n") {
		ip := strings.TrimSpace(line)
		if ip == "" {
			continue
		}
		if i := strings.IndexByte(ip, '/'); i > 0 {
			ip = ip[:i]
		}
		if strings.Contains(ip, ":") {
			continue
		}
		return ip
	}
	return ""
}

func ParseIntLine(raw string) int {
	fields := strings.Fields(strings.TrimSpace(raw))
	if len(fields) == 0 {
		return 0
	}
	n, _ := strconv.Atoi(fields[0])
	return n
}

func SplitSections(raw string) map[string]string {
	out := map[string]string{}
	key := ""
	var b strings.Builder
	flush := func() {
		if key != "" {
			out[key] = strings.TrimSpace(b.String())
		}
		b.Reset()
	}
	for _, line := range strings.Split(raw, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "__SUI_") && strings.HasSuffix(trim, "__") {
			flush()
			key = strings.TrimSuffix(strings.TrimPrefix(trim, "__SUI_"), "__")
			continue
		}
		if key != "" {
			b.WriteString(line)
			b.WriteByte('\n')
		}
	}
	flush()
	return out
}

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

package metrics

import "testing"

func TestParseMemory(t *testing.T) {
	raw := "MemTotal:       8000000 kB\nMemAvailable:   2000000 kB\n"
	got := ParseMemory(raw)
	if got != 75 {
		t.Fatalf("got %v", got)
	}
	used, total := ParseMemoryBytes(raw)
	if total != 8000000*1024 || used != 6000000*1024 {
		t.Fatalf("bytes used=%d total=%d", used, total)
	}
	info := ParseMemoryInfo("MemTotal: 8000000 kB\nMemAvailable: 2000000 kB\nCached: 500000 kB\nBuffers: 100000 kB\nSwapTotal: 1000000 kB\nSwapFree: 250000 kB\n")
	if info.Cached != 500000*1024 || info.Buffers != 100000*1024 || info.SwapUsed() != 750000*1024 {
		t.Fatalf("info %+v", info)
	}
}

func TestParseVmstat(t *testing.T) {
	faults, major := ParseVmstat("pgfault 12456789\npgmajfault 333333\n")
	if faults != 12456789 || major != 333333 {
		t.Fatalf("vmstat %d %d", faults, major)
	}
}

func TestParseDisk(t *testing.T) {
	raw := "Filesystem     1024-blocks    Used Available Capacity Mounted on\n/dev/sda1         1000000  412000    588000      41% /\n"
	got := ParseDisk(raw)
	if got != 41 {
		t.Fatalf("got %v", got)
	}
	mounts := ParseMounts("Filesystem 1B-blocks Used Available Capacity Mounted on\n/dev/vda1 1000000000 412000000 588000000 41% /\ntmpfs 1000 10 990 1% /run\n/dev/vda2 200000000 50000000 150000000 25% /home\n")
	if len(mounts) != 2 || mounts[0].MountPoint != "/" || mounts[1].MountPoint != "/home" {
		t.Fatalf("mounts %+v", mounts)
	}
	if ParentBlockDevice("/dev/nvme0n1p2") != "nvme0n1" || ParentBlockDevice("/dev/vda1") != "vda" {
		t.Fatal("parent device")
	}
	prev := diskSample{reads: 10, writes: 4, readSectors: 100, writeSectors: 40}
	next := diskSample{reads: 30, writes: 10, readSectors: 500, writeSectors: 140}
	readBps, writeBps, readIops, writeIops := DiskRate(prev, next, 2)
	if readBps != 102400 || writeBps != 25600 || readIops != 10 || writeIops != 3 {
		t.Fatalf("disk rate %v %v %v %v", readBps, writeBps, readIops, writeIops)
	}
}

func TestParseUptime(t *testing.T) {
	if ParseUptime("1245600.12 884000.04\n") != 1245600 {
		t.Fatal("uptime parse failed")
	}
}

func TestParseCPUIdentityAndFreq(t *testing.T) {
	raw := "processor : 0\nmodel name : Intel Xeon\ncpu cores : 2\nphysical id : 0\ncpu MHz : 1995.000\n\nprocessor : 1\nphysical id : 0\n"
	info := ParseCPUIdentity(raw)
	if info.Logical != 2 || info.Physical != 2 || info.Model != "Intel Xeon" {
		t.Fatalf("identity %+v", info)
	}
	base, max, cur := ParseCPUFreq("base 2000000\nmax 3000000\ncur 1995000\n")
	if base != 2000 || max != 3000 || cur != 1995 {
		t.Fatalf("freq %v %v %v", base, max, cur)
	}
}

func TestParseThermalAndCache(t *testing.T) {
	temp := ParseThermal("acpitz 45000\nx86_pkg_temp 38000\n")
	if temp != 38 {
		t.Fatalf("temp %v", temp)
	}
	l1, l2, l3 := ParseCacheBytes("index0 1 Data 32K\nindex1 1 Instruction 32K\nindex2 2 Unified 256K\nindex3 3 Unified 30720K\n")
	if l1 != 64*1024 || l2 != 256*1024 || l3 != 30720*1024 {
		t.Fatalf("cache %d %d %d", l1, l2, l3)
	}
}

func TestCPUCoreStats(t *testing.T) {
	raw := "cpu  10 0 5 80 5 0 0 0\ncpu0 5 0 2 40 2 0 0 0\ncpu1 5 0 3 40 3 0 0 0\n"
	cores := ParseCPUCoreStats(raw)
	if len(cores) != 2 {
		t.Fatalf("cores %d", len(cores))
	}
}

func TestCPUPercent(t *testing.T) {
	prev := cpuSample{idle: 100, total: 200}
	next := cpuSample{idle: 130, total: 300}
	got := CPUPercent(prev, next)
	if got != 70 {
		t.Fatalf("got %v", got)
	}
}

func TestParseNetAndRate(t *testing.T) {
	raw := "Inter-|   Receive                                                |  Transmit\n" +
		" face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n" +
		"    lo: 100 0 0 0 0 0 0 0 100 0 0 0 0 0 0 0\n" +
		"  eth0: 2000 1 0 0 0 0 0 0 800 1 0 0 0 0 0 0\n"
	sample := ParseNetDev(raw)
	if sample.rx != 2000 || sample.tx != 800 {
		t.Fatalf("sample %+v", sample)
	}
	rx, tx := NetRate(netSample{rx: 1000, tx: 200}, sample, 2)
	if rx != 500 || tx != 300 {
		t.Fatalf("rate rx=%v tx=%v", rx, tx)
	}
	if ParsePrimaryIface(raw) != "eth0" {
		t.Fatal("primary iface")
	}
	gw, iface := ParseDefaultRoute("default via 203.0.113.1 dev eth0 proto dhcp\n")
	if gw != "203.0.113.1" || iface != "eth0" {
		t.Fatalf("route %s %s", gw, iface)
	}
	ip, bits := ParseIPv4("2: eth0    inet 203.0.113.10/24 brd 203.0.113.255 scope global eth0\n", "eth0")
	if ip != "203.0.113.10" || IPv4Mask(bits) != "255.255.255.0" {
		t.Fatalf("addr %s %d", ip, bits)
	}
	tcp := "  sl  local_address rem_address   st\n   0: 00000000:0016 00000000:0000 0A\n   1: 0A000001:0050 0A000002:E2D4 01\n   2: 0A000001:01BB 0A000003:1F90 06\n"
	active, estab, ports := ParseTCPStats(tcp)
	if active != 2 || estab != 1 || len(ports) != 1 || ports[0] != 22 {
		t.Fatalf("tcp %d %d %v", active, estab, ports)
	}
	procs := ParseSSProcesses("tcp ESTAB 0 0 203.0.113.10:22 203.0.113.20:41000 users:((\"sshd\",pid=833,fd=4))\n", 100, 50)
	if len(procs) != 1 || procs[0].PID != 833 || procs[0].Name != "sshd" || procs[0].RxBps != 100 {
		t.Fatalf("ss %+v", procs)
	}
}

func TestParseProcesses(t *testing.T) {
	raw := "PID %CPU %MEM RSS COMMAND\n  2431  1.2  0.4 1433600 node\n  1189  0.6  0.2 2201600 docker\n"
	got := ParseProcesses(raw)
	if len(got) != 2 || got[0].Name != "node" || got[0].PID != 2431 || got[0].CPU != 1.2 {
		t.Fatalf("got %+v", got)
	}
	rich := ParseProcesses("2431 1 24 deploy 1.8 1.4 1468000 3720 Ssl node\n")
	if len(rich) != 1 || rich[0].User != "deploy" || rich[0].Threads != 24 || rich[0].PPID != 1 {
		t.Fatalf("rich %+v", rich)
	}
	total, user, system, running := ParseProcessCounts("total 246\nuser 198\nsystem 48\nrunning 42\n")
	if total != 246 || user != 198 || system != 48 || running != 42 {
		t.Fatalf("counts %d %d %d %d", total, user, system, running)
	}
}

func TestParseServices(t *testing.T) {
	raw := "nginx.service loaded active running A high performance web server\nfail2ban.service loaded failed failed Fail2Ban Service\nufw.service loaded inactive dead Uncomplicated firewall\n"
	got := ParseServices(raw)
	if len(got) != 3 || got[0].State != "running" || got[1].State != "failed" || got[2].State != "stopped" {
		t.Fatalf("services %+v", got)
	}
	if got[0].Description != "A high performance web server" {
		t.Fatalf("desc %q", got[0].Description)
	}
	run, stop, fail, other := ServiceCounts(got)
	if run != 1 || stop != 1 || fail != 1 || other != 0 {
		t.Fatalf("counts %d %d %d %d", run, stop, fail, other)
	}
	unit, err := SanitizeUnit("nginx")
	if err != nil || unit != "nginx.service" {
		t.Fatalf("unit %s %v", unit, err)
	}
	if _, err := SanitizeUnit("nginx;reboot"); err == nil {
		t.Fatal("expected invalid unit")
	}
}

func TestSplitSections(t *testing.T) {
	raw := "__SUI_HOST__\nserverui\n__SUI_LOAD__\n0.12 0.08 0.05 1/120 99\n"
	sections := SplitSections(raw)
	if ParseHostname(sections["HOST"]) != "serverui" {
		t.Fatalf("host %q", sections["HOST"])
	}
	l1, l5, l15 := ParseLoad(sections["LOAD"])
	if l1 != 0.12 || l5 != 0.08 || l15 != 0.05 {
		t.Fatalf("load %v %v %v", l1, l5, l15)
	}
}

func TestParseOSAndUname(t *testing.T) {
	os := ParseOSRelease("PRETTY_NAME=\"Ubuntu 22.04.4 LTS\"\nNAME=\"Ubuntu\"\n")
	if os != "Ubuntu 22.04.4 LTS" {
		t.Fatalf("os %q", os)
	}
	kernel, arch := ParseUname("Linux 6.5.0-27-generic x86_64")
	if kernel != "6.5.0-27-generic" || arch != "x86_64" {
		t.Fatalf("uname %q %q", kernel, arch)
	}
}

func TestParseFirstIP(t *testing.T) {
	if got := ParseFirstIP("203.0.113.10\n2001:db8::1\n"); got != "203.0.113.10" {
		t.Fatalf("ip %q", got)
	}
}

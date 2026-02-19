import { readFileSync, existsSync } from "fs";

export interface SystemStats {
  cpu_percent: number;
  cpu_temp_celsius: number | null;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  storage_total_gb: number;
  storage_used_gb: number;
  storage_percent: number;
  uptime_seconds: number;
}

function read_cpu_percent(): number {
  try {
    // Read /proc/stat twice with a small delay to compute usage
    const parse_stat = () => {
      const stat = readFileSync("/proc/stat", "utf-8");
      const line = stat.split("\n")[0].trim().split(/\s+/);
      const user = parseInt(line[1]);
      const nice = parseInt(line[2]);
      const system = parseInt(line[3]);
      const idle = parseInt(line[4]);
      const iowait = parseInt(line[5]);
      const irq = parseInt(line[6]);
      const softirq = parseInt(line[7]);
      const total = user + nice + system + idle + iowait + irq + softirq;
      return { idle, total };
    };

    const s1 = parse_stat();
    // Synchronous busy-wait for ~100ms sample
    const start = Date.now();
    while (Date.now() - start < 100) {}
    const s2 = parse_stat();

    const idle_delta = s2.idle - s1.idle;
    const total_delta = s2.total - s1.total;
    if (total_delta === 0) return 0;
    return Math.round((1 - idle_delta / total_delta) * 100);
  } catch {
    return 0;
  }
}

function read_cpu_temp(): number | null {
  const paths = [
    "/sys/class/thermal/thermal_zone0/temp",
    "/sys/class/hwmon/hwmon0/temp1_input",
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = parseInt(readFileSync(p, "utf-8").trim());
        return Math.round(raw / 1000);
      } catch {}
    }
  }
  return null;
}

function read_memory(): Pick<
  SystemStats,
  "memory_total_mb" | "memory_used_mb" | "memory_percent"
> {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf-8");
    const get_kb = (key: string): number => {
      const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return match ? parseInt(match[1]) : 0;
    };

    const total_kb = get_kb("MemTotal");
    const available_kb = get_kb("MemAvailable");
    const used_kb = total_kb - available_kb;

    const total_mb = Math.round(total_kb / 1024);
    const used_mb = Math.round(used_kb / 1024);
    return {
      memory_total_mb: total_mb,
      memory_used_mb: used_mb,
      memory_percent: total_mb > 0 ? Math.round((used_mb / total_mb) * 100) : 0,
    };
  } catch {
    return { memory_total_mb: 0, memory_used_mb: 0, memory_percent: 0 };
  }
}

async function read_storage(): Promise<
  Pick<
    SystemStats,
    "storage_total_gb" | "storage_used_gb" | "storage_percent"
  >
> {
  try {
    const proc = Bun.spawn(["df", "-BG", "/"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    const reader = proc.stdout?.getReader();
    const decoder = new TextDecoder();
    let output = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
      }
    }

    const lines = output.trim().split("\n");
    if (lines.length < 2) throw new Error("no df output");
    const parts = lines[1].trim().split(/\s+/);
    const total_gb = parseInt(parts[1]);
    const used_gb = parseInt(parts[2]);

    return {
      storage_total_gb: total_gb,
      storage_used_gb: used_gb,
      storage_percent:
        total_gb > 0 ? Math.round((used_gb / total_gb) * 100) : 0,
    };
  } catch {
    return { storage_total_gb: 0, storage_used_gb: 0, storage_percent: 0 };
  }
}

function read_uptime(): number {
  try {
    const uptime = readFileSync("/proc/uptime", "utf-8");
    return Math.floor(parseFloat(uptime.split(" ")[0]));
  } catch {
    return 0;
  }
}

export async function get_system_stats(): Promise<SystemStats> {
  const [storage] = await Promise.all([read_storage()]);
  return {
    cpu_percent: read_cpu_percent(),
    cpu_temp_celsius: read_cpu_temp(),
    ...read_memory(),
    ...storage,
    uptime_seconds: read_uptime(),
  };
}

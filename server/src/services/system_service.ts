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

/** Cached CPU measurements for async sampling */
let last_cpu_idle = 0;
let last_cpu_total = 0;
let last_cpu_percent = 0;

function parse_cpu_stat(): { idle: number; total: number } {
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
}

/** Non-blocking CPU measurement using async delay (BE-014) */
async function read_cpu_percent(): Promise<number> {
    try {
        const s1 = parse_cpu_stat();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const s2 = parse_cpu_stat();

        const idle_delta = s2.idle - s1.idle;
        const total_delta = s2.total - s1.total;
        if (total_delta === 0) return last_cpu_percent;

        last_cpu_idle = s2.idle;
        last_cpu_total = s2.total;
        last_cpu_percent = Math.round((1 - idle_delta / total_delta) * 100);
        return last_cpu_percent;
    } catch (error) {
        console.warn("[system_service] Failed to read CPU stats:", error);
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
            } catch (error) {
                console.warn(`[system_service] Failed to read CPU temp from ${p}:`, error);
            }
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
    } catch (error) {
        console.warn("[system_service] Failed to read memory stats:", error);
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
    } catch (error) {
        console.warn("[system_service] Failed to read storage stats:", error);
        return { storage_total_gb: 0, storage_used_gb: 0, storage_percent: 0 };
    }
}

function read_uptime(): number {
    try {
        const uptime = readFileSync("/proc/uptime", "utf-8");
        return Math.floor(parseFloat(uptime.split(" ")[0]));
    } catch (error) {
        console.warn("[system_service] Failed to read uptime:", error);
        return 0;
    }
}

export async function get_system_stats(): Promise<SystemStats> {
    const [cpu_percent, storage] = await Promise.all([read_cpu_percent(), read_storage()]);
    return {
        cpu_percent,
        cpu_temp_celsius: read_cpu_temp(),
        ...read_memory(),
        ...storage,
        uptime_seconds: read_uptime(),
    };
}

// --- Model listing ---

import { COPILOT_BIN, ENRICHED_PATH } from "../env";

interface ModelOption {
    value: string;
    label: string;
}

let cached_copilot_models: ModelOption[] | null = null;
const cached_gemini_models: ModelOption[] = [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

function format_model_label(id: string): string {
    return id
        .split("-")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export async function get_models(cli: string): Promise<ModelOption[]> {
    if (cli === "gemini") {
        return cached_gemini_models;
    }

    if (cached_copilot_models) return cached_copilot_models;

    try {
        const proc = Bun.spawn([COPILOT_BIN, "--help"], {
            stdout: "pipe",
            stderr: "pipe",
            env: { ...process.env, PATH: ENRICHED_PATH },
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;

        const match = output.match(/--model\s+<model>\s+.*?\(choices:\s*([\s\S]*?)\)/);
        if (match) {
            const choices_str = match[1];
            const model_ids = [...choices_str.matchAll(/"([^"]+)"/g)].map(m => m[1]);
            cached_copilot_models = model_ids.map(id => ({ value: id, label: format_model_label(id) }));
        }
    } catch (err) {
        console.error("[system_service] Failed to parse models from Copilot CLI:", err);
    }

    if (!cached_copilot_models) {
        cached_copilot_models = [];
    }

    return cached_copilot_models;
}


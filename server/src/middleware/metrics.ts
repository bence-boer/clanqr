import type { Context, Next } from "hono";
import type { AppBindings } from "./supabase";

interface RouteMetrics {
    total_requests: number;
    total_errors: number;
    avg_latency_ms: number;
    latency_samples: number[];
}

const metrics = new Map<string, RouteMetrics>();

const MAX_SAMPLES = 100;

export function metrics_middleware() {
    return async (c: Context<AppBindings>, next: Next) => {
        const start = performance.now();

        await next();

        const duration = performance.now() - start;
        // Normalize dynamic path params to reduce cardinality
        const path = c.req.routePath ?? c.req.path;
        const key = `${c.req.method} ${path}`;

        const entry = metrics.get(key) ?? {
            total_requests: 0,
            total_errors: 0,
            avg_latency_ms: 0,
            latency_samples: [],
        };

        entry.total_requests++;
        if (c.res.status >= 400) entry.total_errors++;
        entry.latency_samples.push(duration);

        if (entry.latency_samples.length > MAX_SAMPLES) {
            entry.latency_samples = entry.latency_samples.slice(-MAX_SAMPLES);
        }

        entry.avg_latency_ms =
            entry.latency_samples.reduce((a, b) => a + b, 0) /
            entry.latency_samples.length;

        metrics.set(key, entry);
    };
}

export interface MetricsSnapshot {
    [route: string]: Omit<RouteMetrics, "latency_samples"> & { p95_latency_ms: number };
}

export function get_metrics(): MetricsSnapshot {
    const result: MetricsSnapshot = {};
    for (const [key, entry] of metrics) {
        const sorted = [...entry.latency_samples].sort((a, b) => a - b);
        const p95_idx = Math.floor(sorted.length * 0.95);
        result[key] = {
            total_requests: entry.total_requests,
            total_errors: entry.total_errors,
            avg_latency_ms: Math.round(entry.avg_latency_ms * 100) / 100,
            p95_latency_ms: Math.round((sorted[p95_idx] ?? 0) * 100) / 100,
        };
    }
    return result;
}

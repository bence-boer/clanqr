import type { Context, Next } from "hono";

const request_counts = new Map<string, { count: number; reset_at: number }>();

// Periodic cleanup to prevent memory leak from stale entries
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of request_counts) {
        if (now > entry.reset_at) {
            request_counts.delete(ip);
        }
    }
}, 60_000);

export function rate_limit(max_requests: number, window_ms: number) {
    return async (c: Context, next: Next) => {
        const forwarded = c.req.header("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",").pop()?.trim() ?? "unknown" : c.req.header("x-real-ip") ?? "unknown";
        const now = Date.now();
        const entry = request_counts.get(ip);

        if (!entry || now > entry.reset_at) {
            request_counts.set(ip, { count: 1, reset_at: now + window_ms });
        } else if (entry.count >= max_requests) {
            return c.json({ error: "Rate limit exceeded" }, 429);
        } else {
            entry.count++;
        }

        await next();
    };
}

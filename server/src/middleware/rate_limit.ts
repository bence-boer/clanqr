import type { Context, Next } from 'hono';

const MAX_ENTRIES = 10_000;

export function rate_limit(max_requests: number, window_ms: number) {
    const request_counts = new Map<string, { count: number, reset_at: number }>();

    // Periodic cleanup to prevent memory leak from stale entries
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of request_counts) {
            if (now > entry.reset_at) {
                request_counts.delete(ip);
            }
        }
    }, 60_000);

    return async (c: Context, next: Next) => {
        // Priority: X-Real-IP (set by nginx) > first X-Forwarded-For entry > 'unknown'
        const ip = c.req.header('x-real-ip')
          ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
          ?? 'unknown';
        const now = Date.now();
        const entry = request_counts.get(ip);

        if (!entry || now > entry.reset_at) {
            // Evict expired entries if at capacity
            if (request_counts.size >= MAX_ENTRIES) {
                for (const [key, val] of request_counts) {
                    if (now > val.reset_at) request_counts.delete(key);
                }
                // If still at cap after cleanup, reject to prevent OOM
                if (request_counts.size >= MAX_ENTRIES) {
                    return c.json({ error: 'Rate limit exceeded' }, 429);
                }
            }
            request_counts.set(ip, { count: 1, reset_at: now + window_ms });
        }
        else if (entry.count >= max_requests) {
            return c.json({ error: 'Rate limit exceeded' }, 429);
        }
        else {
            entry.count++;
        }

        await next();
    };
}

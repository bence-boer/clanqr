import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { rate_limit } from "./rate_limit";

function create_rate_limit_app(max_requests: number, window_ms: number) {
    const app = new Hono();
    app.use("*", rate_limit(max_requests, window_ms));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
}

describe("rate_limit middleware", () => {
    describe("IP extraction", () => {
        it("extracts rightmost IP from x-forwarded-for", async () => {
            // Use a unique IP per test to avoid cross-test state interference
            const app = create_rate_limit_app(1, 60_000);

            const res = await app.request("/test", {
                headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 100.0.0.1" },
            });
            expect(res.status).toBe(200);

            // Second request from same extracted IP (100.0.0.1) should be blocked
            const res2 = await app.request("/test", {
                headers: { "x-forwarded-for": "9.9.9.9, 100.0.0.1" },
            });
            expect(res2.status).toBe(429);
        });

        it("falls back to x-real-ip when no x-forwarded-for", async () => {
            const app = create_rate_limit_app(1, 60_000);

            const res = await app.request("/test", {
                headers: { "x-real-ip": "100.0.0.2" },
            });
            expect(res.status).toBe(200);

            // Second request from same x-real-ip
            const res2 = await app.request("/test", {
                headers: { "x-real-ip": "100.0.0.2" },
            });
            expect(res2.status).toBe(429);
        });

        it("uses 'unknown' when no IP headers present", async () => {
            const app = create_rate_limit_app(2, 60_000);

            const res1 = await app.request("/test");
            expect(res1.status).toBe(200);
            const res2 = await app.request("/test");
            expect(res2.status).toBe(200);
            // Third request exceeds limit for "unknown" IP
            const res3 = await app.request("/test");
            expect(res3.status).toBe(429);
        });
    });

    describe("rate limiting", () => {
        it("allows requests within the limit", async () => {
            const app = create_rate_limit_app(3, 60_000);

            for (let i = 0; i < 3; i++) {
                const res = await app.request("/test", {
                    headers: { "x-forwarded-for": "100.0.0.3" },
                });
                expect(res.status).toBe(200);
            }
        });

        it("blocks requests exceeding the limit", async () => {
            const app = create_rate_limit_app(2, 60_000);

            const res1 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.4" },
            });
            expect(res1.status).toBe(200);

            const res2 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.4" },
            });
            expect(res2.status).toBe(200);

            const res3 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.4" },
            });
            expect(res3.status).toBe(429);
            const body = await res3.json() as { error: string };
            expect(body.error).toBe("Rate limit exceeded");
        });

        it("different IPs have independent limits", async () => {
            const app = create_rate_limit_app(1, 60_000);

            const res1 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.5" },
            });
            expect(res1.status).toBe(200);

            // Different IP should still be allowed
            const res2 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.6" },
            });
            expect(res2.status).toBe(200);
        });

        it("resets after window expires", async () => {
            // Use a very short window
            const app = create_rate_limit_app(1, 50);

            const res1 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.7" },
            });
            expect(res1.status).toBe(200);

            const res2 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.7" },
            });
            expect(res2.status).toBe(429);

            // Wait for window to expire
            await new Promise(resolve => setTimeout(resolve, 60));

            const res3 = await app.request("/test", {
                headers: { "x-forwarded-for": "100.0.0.7" },
            });
            expect(res3.status).toBe(200);
        });
    });
});

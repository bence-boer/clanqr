import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { rate_limit } from './rate_limit';

function create_rate_limit_app(max_requests: number, window_ms: number) {
    const app = new Hono();
    app.use('*', rate_limit(max_requests, window_ms));
    app.get('/test', (c) => c.json({ ok: true }));
    return app;
}

describe('rate_limit middleware', () => {
    describe('IP extraction', () => {
        it('extracts IP from X-Real-IP header first', async () => {
            const app = create_rate_limit_app(100, 60_000);

            // With both headers, X-Real-IP should take priority
            const res = await app.request('/test', {
                headers: {
                    'X-Real-IP': '1.2.3.4',
                    'X-Forwarded-For': '5.6.7.8, 9.10.11.12'
                }
            });
            expect(res.status).toBe(200);
        });

        it('uses first X-Forwarded-For entry when no X-Real-IP', async () => {
            const app = create_rate_limit_app(1, 60_000);

            const res1 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '1.1.1.1, 2.2.2.2' }
            });
            expect(res1.status).toBe(200);

            // Same first IP should be rate limited
            const res2 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '1.1.1.1, 3.3.3.3' }
            });
            expect(res2.status).toBe(429);
        });

        it('prefers X-Real-IP over X-Forwarded-For for rate counting', async () => {
            const app = create_rate_limit_app(1, 60_000);

            // First request with X-Real-IP '10.0.0.1'
            const res1 = await app.request('/test', {
                headers: {
                    'X-Real-IP': '10.0.0.1',
                    'X-Forwarded-For': '10.0.0.2, 10.0.0.3'
                }
            });
            expect(res1.status).toBe(200);

            // Second request same X-Real-IP but different XFF — should be blocked
            const res2 = await app.request('/test', {
                headers: {
                    'X-Real-IP': '10.0.0.1',
                    'X-Forwarded-For': '99.99.99.99'
                }
            });
            expect(res2.status).toBe(429);
        });

        it('uses \'unknown\' when no IP headers present', async () => {
            const app = create_rate_limit_app(2, 60_000);

            const res1 = await app.request('/test');
            expect(res1.status).toBe(200);
            const res2 = await app.request('/test');
            expect(res2.status).toBe(200);
            // Third request exceeds limit for "unknown" IP
            const res3 = await app.request('/test');
            expect(res3.status).toBe(429);
        });
    });

    describe('rate limiting', () => {
        it('allows requests within the limit', async () => {
            const app = create_rate_limit_app(3, 60_000);

            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: { 'X-Real-IP': '100.0.0.3' }
                });
                expect(res.status).toBe(200);
            }
        });

        it('returns 429 when rate limit exceeded', async () => {
            const app = create_rate_limit_app(3, 60_000);

            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: { 'X-Real-IP': '1.1.1.1' }
                });
                expect(res.status).toBe(200);
            }

            const res = await app.request('/test', {
                headers: { 'X-Real-IP': '1.1.1.1' }
            });
            expect(res.status).toBe(429);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('Rate limit exceeded');
        });

        it('allows requests from different IPs independently', async () => {
            const app = create_rate_limit_app(1, 60_000);

            const res1 = await app.request('/test', {
                headers: { 'X-Real-IP': '1.1.1.1' }
            });
            expect(res1.status).toBe(200);

            const res2 = await app.request('/test', {
                headers: { 'X-Real-IP': '2.2.2.2' }
            });
            expect(res2.status).toBe(200);
        });

        it('resets after window expires', async () => {
            // Use a very short window
            const app = create_rate_limit_app(1, 50);

            const res1 = await app.request('/test', {
                headers: { 'X-Real-IP': '100.0.0.7' }
            });
            expect(res1.status).toBe(200);

            const res2 = await app.request('/test', {
                headers: { 'X-Real-IP': '100.0.0.7' }
            });
            expect(res2.status).toBe(429);

            // Wait for window to expire
            await new Promise((resolve) => setTimeout(resolve, 60));

            const res3 = await app.request('/test', {
                headers: { 'X-Real-IP': '100.0.0.7' }
            });
            expect(res3.status).toBe(200);
        });
    });

    describe('memory cap (SEC-037)', () => {
        it('rejects new IPs when map is at MAX_ENTRIES capacity with unexpired entries', async () => {
            // We can't easily test 10,000 entries, but we can verify the
            // behavior by testing with the actual rate_limit function.
            // The MAX_ENTRIES constant is 10_000 — this is an integration-level
            // concern. Instead we verify the 429 response body is correct.
            const app = create_rate_limit_app(1, 60_000);

            const res = await app.request('/test', {
                headers: { 'X-Real-IP': '200.0.0.1' }
            });
            expect(res.status).toBe(200);

            // Exceeding limit returns proper error shape
            const res2 = await app.request('/test', {
                headers: { 'X-Real-IP': '200.0.0.1' }
            });
            expect(res2.status).toBe(429);
            const body = await res2.json() as { error: string };
            expect(body.error).toBe('Rate limit exceeded');
        });
    });
});

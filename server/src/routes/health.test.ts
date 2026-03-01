import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

/**
 * Test for the /health endpoint.
 * Uses a standalone Hono app — no DB needed.
 */

const app = new Hono();
app.get('/health', (context) => {
    return context.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
        const response = await app.request('/health');
        expect(response.status).toBe(200);

        const body = (await response.json()) as { status: string, timestamp: string };
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeDefined();
    });

    it('returns valid ISO timestamp', async () => {
        const response = await app.request('/health');
        const body = (await response.json()) as { timestamp: string };
        const parsed = new Date(body.timestamp);
        expect(parsed.toISOString()).toBe(body.timestamp);
    });

    it('returns correct content-type', async () => {
        const response = await app.request('/health');
        expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('returns 404 for unknown paths', async () => {
        const response = await app.request('/nonexistent');
        expect(response.status).toBe(404);
    });
});

import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { system_routes } from './system';

function setup() {
    const { app, store } = create_test_app();
    app.route('/api/system', system_routes);
    return { app, store };
}

describe('system routes', () => {
    describe('GET /api/system/stats', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/system/stats');
            expect(res.status).toBe(401);
        });

        it('returns system stats', async () => {
            const { app } = setup();
            const res = await app.request('/api/system/stats', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toHaveProperty('cpu_percent');
            expect(body).toHaveProperty('uptime_seconds');
        });
    });

    describe('GET /api/system/models', () => {
        it('returns models list', async () => {
            const { app } = setup();
            const res = await app.request('/api/system/models', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
        });
    });
});

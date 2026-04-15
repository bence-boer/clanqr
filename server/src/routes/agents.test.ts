import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers, admin_headers } from '../test-app';
import { agents_routes } from './agents';

function setup() {
    const { app, store } = create_test_app();
    app.route('/api/agents', agents_routes);
    return { app, store };
}

describe('agents routes', () => {
    describe('GET /api/agents/queue', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/queue');
            expect(res.status).toBe(401);
        });

        it('returns queue status', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/queue', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toHaveProperty('state');
            expect(body).toHaveProperty('queue_depth');
        });
    });

    describe('POST /api/agents/pause', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/pause', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });

        it('pauses the pipeline for admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/pause', {
                method: 'POST',
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
        });
    });

    describe('POST /api/agents/resume', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/resume', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });

        it('resumes the pipeline for admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/resume', {
                method: 'POST',
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
        });
    });

    describe('POST /api/agents/stop-current', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/stop-current', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });

        it('stops the current task for admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/stop-current', {
                method: 'POST',
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
        });
    });

    describe('GET /api/agents/queue/log', () => {
        it('returns pipeline log', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/queue/log', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toHaveProperty('log');
        });
    });

    describe('GET /api/agents/status', () => {
        it('returns all process statuses', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/status', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
        });
    });

    describe('POST /api/agents/stop-all', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/stop-all', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });

        it('stops all agents for admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/stop-all', {
                method: 'POST',
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
        });
    });

    describe('PATCH /api/agents/queue/reorder', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/queue/reorder', {
                method: 'PATCH',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_ids: ['00000000-0000-0000-0000-000000000020'] })
            });
            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/agents/plan/:feature_id', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/plan/00000000-0000-0000-0000-000000000010', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/agents/verify/:task_id', () => {
        it('returns 403 for non-admin', async () => {
            const { app } = setup();
            const res = await app.request('/api/agents/verify/00000000-0000-0000-0000-000000000020', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });
    });
});

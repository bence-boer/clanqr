import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { skills_routes } from './skills';
import { TEST_SEED } from '../test-utils';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        skill_links: [
            {
                id: '00000000-0000-0000-0000-000000000050',
                task_id: '00000000-0000-0000-0000-000000000020',
                skill_name: 'test-skill',
                created_at: '2026-01-01T00:00:00Z'
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/skills', skills_routes);
    return { app, store };
}

const TASK_ID = '00000000-0000-0000-0000-000000000020';
const LINK_ID = '00000000-0000-0000-0000-000000000050';
const INVALID_UUID = 'not-a-uuid';

describe('skills routes', () => {
    describe('GET /api/skills', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/skills');
            expect(res.status).toBe(401);
        });

        it('returns skills list', async () => {
            const { app } = setup();
            const res = await app.request('/api/skills', { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
        });
    });

    describe('POST /api/skills/refresh', () => {
        it('refreshes skill cache', async () => {
            const { app } = setup();
            const res = await app.request('/api/skills/refresh', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(typeof body.refreshed).toBe('number');
        });
    });

    describe('GET /api/skills/task/:task_id', () => {
        it('returns skills linked to a task', async () => {
            const { app } = setup();
            const res = await app.request(`/api/skills/task/${TASK_ID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
        });

        it('rejects invalid UUID', async () => {
            const { app } = setup();
            const res = await app.request(`/api/skills/task/${INVALID_UUID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/skills/link', () => {
        it('rejects missing task_id', async () => {
            const { app } = setup();
            const res = await app.request('/api/skills/link', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ skill_name: 'test' })
            });
            expect(res.status).toBe(400);
        });

        it('rejects empty skill_name', async () => {
            const { app } = setup();
            const res = await app.request('/api/skills/link', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: TASK_ID, skill_name: '' })
            });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/skills/link/:id', () => {
        it('unlinks a skill', async () => {
            const { app, store } = setup();
            const res = await app.request(`/api/skills/link/${LINK_ID}`, {
                method: 'DELETE',
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            expect(store.skill_links.length).toBe(0);
        });

        it('rejects invalid UUID', async () => {
            const { app } = setup();
            const res = await app.request(`/api/skills/link/${INVALID_UUID}`, {
                method: 'DELETE',
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });
});

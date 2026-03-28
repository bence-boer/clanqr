import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { usage_routes } from './usage';
import { TEST_SEED } from '../test-utils';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        agent_sessions: [
            {
                id: '00000000-0000-0000-0000-000000000060',
                agent_type: 'ralph',
                status: 'completed',
                model: 'claude-sonnet-4.5',
                task_id: '00000000-0000-0000-0000-000000000020',
                feature_id: '00000000-0000-0000-0000-000000000010',
                duration_ms: 5000,
                prompt_tokens: null,
                completion_tokens: null,
                created_at: '2026-01-01T00:00:00Z'
            },
            {
                id: '00000000-0000-0000-0000-000000000061',
                agent_type: 'manager',
                status: 'failed',
                model: 'claude-sonnet-4.5',
                task_id: null,
                feature_id: '00000000-0000-0000-0000-000000000010',
                duration_ms: 3000,
                prompt_tokens: null,
                completion_tokens: null,
                created_at: '2026-01-02T00:00:00Z'
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/usage', usage_routes);
    return { app, store };
}

describe('usage routes', () => {
    describe('GET /api/usage/summary', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/summary');
            expect(res.status).toBe(401);
        });

        it('returns usage summary', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/summary', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/usage/history', () => {
        it('returns paginated history', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/history', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toHaveProperty('runs');
            expect(body).toHaveProperty('total');
            expect(body).toHaveProperty('page');
            expect(body).toHaveProperty('per_page');
            expect(body).toHaveProperty('total_pages');
        });

        it('supports type filter', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/history?type=ralph', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { runs: Record<string, unknown>[] };
            expect(body.runs.every((r: Record<string, unknown>) => r.agent_type === 'ralph')).toBe(true);
        });

        it('supports status filter', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/history?status=failed', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { runs: Record<string, unknown>[] };
            expect(body.runs.every((r: Record<string, unknown>) => r.status === 'failed')).toBe(true);
        });

        it('rejects invalid page parameter', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/history?page=0', {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });

        it('rejects invalid type parameter', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/history?type=invalid', {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/usage/breakdown', () => {
        it('returns usage breakdown', async () => {
            const { app } = setup();
            const res = await app.request('/api/usage/breakdown', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
        });
    });
});

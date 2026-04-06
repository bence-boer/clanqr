import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { prompts_routes } from './prompts';
import { TEST_SEED } from '../test-utils';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        prompts: [
            {
                id: '00000000-0000-0000-0000-000000000070',
                agent_type: 'orchestrator',
                content: 'You are an orchestrator agent.',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            },
            {
                id: '00000000-0000-0000-0000-000000000071',
                agent_type: 'implementer',
                content: 'You are an implementer agent.',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/prompts', prompts_routes);
    return { app, store };
}

describe('prompts routes', () => {
    describe('GET /api/prompts', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts');
            expect(res.status).toBe(401);
        });

        it('returns all prompts', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts', { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(body.length).toBe(2);
        });
    });

    describe('GET /api/prompts/:role', () => {
        it('returns prompt for orchestrator', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/orchestrator', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.agent_type).toBe('orchestrator');
        });

        it('returns prompt for implementer', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/implementer', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.agent_type).toBe('implementer');
        });

        it('rejects invalid role', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/invalid', {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/prompts/:role', () => {
        it('rejects invalid role', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/invalid', {
                method: 'PATCH',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'Updated content' })
            });
            expect(res.status).toBe(400);
        });

        it('rejects empty content', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/orchestrator', {
                method: 'PATCH',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '' })
            });
            expect(res.status).toBe(400);
        });
    });
});

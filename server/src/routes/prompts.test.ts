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
                role: 'manager',
                content: 'You are a manager agent.',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            },
            {
                id: '00000000-0000-0000-0000-000000000071',
                role: 'ralph',
                content: 'You are Ralph.',
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
        it('returns prompt for manager role', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/manager', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.role).toBe('manager');
        });

        it('returns prompt for ralph role', async () => {
            const { app } = setup();
            const res = await app.request('/api/prompts/ralph', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.role).toBe('ralph');
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
            const res = await app.request('/api/prompts/manager', {
                method: 'PATCH',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '' })
            });
            expect(res.status).toBe(400);
        });
    });
});

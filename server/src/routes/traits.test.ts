import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { traits_routes } from './traits';
import { TEST_SEED } from '../test-utils';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        traits: [
            {
                id: '00000000-0000-0000-0000-000000000040',
                name: 'Careful Coder',
                description: 'Write careful code',
                target: 'ralph',
                content: 'Be careful and thorough.',
                is_global: true,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            },
            {
                id: '00000000-0000-0000-0000-000000000041',
                name: 'Manager Trait',
                description: 'Manager-only',
                target: 'manager',
                content: 'Plan well.',
                is_global: false,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            }
        ],
        trait_assignments: [
            {
                id: '00000000-0000-0000-0000-000000000042',
                trait_id: '00000000-0000-0000-0000-000000000040',
                scope: 'project',
                project_id: '00000000-0000-0000-0000-000000000001',
                feature_id: null,
                task_id: null,
                is_excluded: false,
                assigned_by: 'user'
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/traits', traits_routes);
    return { app, store };
}

const TRAIT_ID = '00000000-0000-0000-0000-000000000040';
const INVALID_UUID = 'not-a-uuid';

describe('traits routes', () => {
    describe('GET /api/traits', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits');
            expect(res.status).toBe(401);
        });

        it('returns all traits', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits', { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(body.length).toBe(2);
        });

        it('filters by target', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits?target=ralph', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(body.every((t: Record<string, unknown>) => t.target === 'ralph')).toBe(true);
        });
    });

    describe('POST /api/traits', () => {
        it('creates a trait', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'New Trait',
                    target: 'ralph',
                    content: 'Some content'
                })
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.name).toBe('New Trait');
        });

        it('rejects missing name', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: 'ralph', content: 'Content' })
            });
            expect(res.status).toBe(400);
        });

        it('rejects invalid target', async () => {
            const { app } = setup();
            const res = await app.request('/api/traits', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Bad', target: 'invalid', content: 'x' })
            });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/traits/:id', () => {
        it('returns a trait with assignment count', async () => {
            const { app } = setup();
            const res = await app.request(`/api/traits/${TRAIT_ID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.name).toBe('Careful Coder');
        });

        it('rejects invalid UUID', async () => {
            const { app } = setup();
            const res = await app.request(`/api/traits/${INVALID_UUID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/traits/:id', () => {
        it('updates a trait', async () => {
            const { app } = setup();
            const res = await app.request(`/api/traits/${TRAIT_ID}`, {
                method: 'PATCH',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Trait' })
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.name).toBe('Updated Trait');
        });
    });

    describe('DELETE /api/traits/:id', () => {
        it('deletes a trait', async () => {
            const { app, store } = setup();
            const before = store.traits.length;
            const res = await app.request(`/api/traits/${TRAIT_ID}`, {
                method: 'DELETE',
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            expect(store.traits.length).toBe(before - 1);
        });
    });
});

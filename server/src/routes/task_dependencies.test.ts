import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { TEST_SEED } from '../test-utils';
import { task_dependency_routes } from './task_dependencies';

const TASK_ID = '00000000-0000-0000-0000-000000000020';
const TASK2_ID = '00000000-0000-0000-0000-000000000021';
const FEATURE_ID = '00000000-0000-0000-0000-000000000010';
const DEP_ID = '00000000-0000-0000-0000-000000000030';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        tasks: [
            ...JSON.parse(JSON.stringify(TEST_SEED.tasks)),
            {
                id: TASK2_ID,
                feature_id: FEATURE_ID,
                description: 'Second task',
                status: 'queued',
                sort_order: 1,
                retry_count: 0,
                max_retries: 1,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            }
        ],
        task_dependencies: [
            {
                id: DEP_ID,
                task_id: TASK2_ID,
                depends_on_task_id: TASK_ID
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/tasks', task_dependency_routes);
    return { app, store };
}

describe('task_dependency routes', () => {
    describe('GET /api/tasks/:id/dependencies', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK2_ID}/dependencies`);
            expect(res.status).toBe(401);
        });

        it('returns dependencies for a task', async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK2_ID}/dependencies`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(1);
            expect(body[0].depends_on_task_id).toBe(TASK_ID);
        });

        it('returns empty array for task with no dependencies', async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}/dependencies`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(body).toEqual([]);
        });

        it('returns 400 for invalid UUID', async () => {
            const { app } = setup();
            const res = await app.request('/api/tasks/not-a-uuid/dependencies', {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/tasks/:id/dependencies', () => {
        it('creates a new dependency', async () => {
            const { app, store } = setup();
            const before = store.task_dependencies.length;
            const res = await app.request(`/api/tasks/${TASK_ID}/dependencies`, {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ depends_on_task_id: TASK2_ID })
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.task_id).toBe(TASK_ID);
            expect(body.depends_on_task_id).toBe(TASK2_ID);
            expect(store.task_dependencies.length).toBe(before + 1);
        });

        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}/dependencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depends_on_task_id: TASK2_ID })
            });
            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/tasks/:id/dependencies/:dep_id', () => {
        it('removes a dependency', async () => {
            const { app, store } = setup();
            expect(store.task_dependencies.length).toBe(1);
            const res = await app.request(
                `/api/tasks/${TASK2_ID}/dependencies/${TASK_ID}`,
                { method: 'DELETE', headers: auth_headers() }
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
            expect(store.task_dependencies.length).toBe(0);
        });

        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request(
                `/api/tasks/${TASK2_ID}/dependencies/${TASK_ID}`,
                { method: 'DELETE' }
            );
            expect(res.status).toBe(401);
        });
    });
});

import { describe, expect, it, mock } from 'bun:test';

// --- Mocks must be registered before importing routes ---

const MOCK_AGENTS = [
    { name: 'orchestrator', description: 'Plans work', model: 'gpt-4.1', tools: ['bash', 'edit'] },
    { name: 'implementer', description: 'Writes code', model: 'gpt-4.1', tools: ['bash', 'edit', 'view'] }
];

mock.module('../services/agent_registry_service', () => ({
    agent_registry_service: {
        list_agent_types: async () => MOCK_AGENTS,
        get_agent_type: async (name: string) => MOCK_AGENTS.find((a) => a.name === name) ?? null,
        sync_agent_types: async () => {
        }
    }
}));

mock.module('../utils/logger', () => ({
    logger: { debug: () => {
    }, info: () => {
    }, warn: () => {
    }, error: () => {
    } }
}));

import { create_test_app, auth_headers } from '../test-app';
import { agent_types_routes } from './agent_types';

function setup() {
    const { app, store } = create_test_app();
    app.route('/api/agent-types', agent_types_routes);
    return { app, store };
}

describe('agent_types routes', () => {
    describe('GET /api/agent-types', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types');
            expect(res.status).toBe(401);
        });

        it('returns list of agent types', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types', { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(2);
            expect(body[0].name).toBe('orchestrator');
            expect(body[1].name).toBe('implementer');
        });
    });

    describe('GET /api/agent-types/:name', () => {
        it('returns a specific agent type', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types/orchestrator', { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.name).toBe('orchestrator');
            expect(body.description).toBe('Plans work');
            expect(Array.isArray(body.tools)).toBe(true);
        });

        it('returns 404 for nonexistent agent type', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types/nonexistent', { headers: auth_headers() });
            expect(res.status).toBe(404);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.error).toBe('Agent type not found');
        });

        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types/orchestrator');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/agent-types/sync', () => {
        it('returns success with count', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types/sync', {
                method: 'POST',
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
            expect(body.count).toBe(2);
        });

        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/agent-types/sync', { method: 'POST' });
            expect(res.status).toBe(401);
        });
    });
});

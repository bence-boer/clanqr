import { describe, expect, it } from 'bun:test';
import { create_test_app, auth_headers } from '../test-app';
import { chat_routes } from './chat';
import { TEST_SEED } from '../test-utils';

function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        chat_sessions: [
            {
                id: '00000000-0000-0000-0000-000000000030',
                title: 'Test Chat',
                model: 'claude-sonnet-4.5',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
            }
        ],
        chat_messages: [
            {
                id: '00000000-0000-0000-0000-000000000031',
                session_id: '00000000-0000-0000-0000-000000000030',
                role: 'user',
                content: 'Hello',
                created_at: '2026-01-01T00:00:00Z'
            }
        ]
    };
    const { app, store } = create_test_app(seed);
    app.route('/api/chat', chat_routes);
    return { app, store };
}

const SESSION_ID = '00000000-0000-0000-0000-000000000030';
const INVALID_UUID = 'not-a-uuid';

describe('chat routes', () => {
    describe('GET /api/chat/sessions', () => {
        it('returns 401 without auth', async () => {
            const { app } = setup();
            const res = await app.request('/api/chat/sessions');
            expect(res.status).toBe(401);
        });

        it('returns sessions list', async () => {
            const { app } = setup();
            const res = await app.request('/api/chat/sessions', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>[];
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBe(1);
        });
    });

    describe('POST /api/chat/sessions', () => {
        it('creates a session with defaults', async () => {
            const { app } = setup();
            const res = await app.request('/api/chat/sessions', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(201);
        });

        it('creates a session with title and model', async () => {
            const { app } = setup();
            const res = await app.request('/api/chat/sessions', {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'My Chat', model: 'gpt-4' })
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.title).toBe('My Chat');
            expect(body.model).toBe('gpt-4');
        });
    });

    describe('GET /api/chat/sessions/:id', () => {
        it('returns session with messages', async () => {
            const { app } = setup();
            const res = await app.request(`/api/chat/sessions/${SESSION_ID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.id).toBe(SESSION_ID);
        });

        it('returns 404 for non-existent session', async () => {
            const { app } = setup();
            const res = await app.request(
                '/api/chat/sessions/00000000-0000-0000-0000-000000099999',
                { headers: auth_headers() }
            );
            expect(res.status).toBe(404);
        });

        it('rejects invalid UUID', async () => {
            const { app } = setup();
            const res = await app.request(`/api/chat/sessions/${INVALID_UUID}`, {
                headers: auth_headers()
            });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/chat/sessions/:id', () => {
        it('deletes a session', async () => {
            const { app, store } = setup();
            const res = await app.request(`/api/chat/sessions/${SESSION_ID}`, {
                method: 'DELETE',
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            expect(store.chat_sessions.length).toBe(0);
        });
    });

    describe('POST /api/chat/sessions/:id/send', () => {
        it('returns 404 for non-existent session', async () => {
            const { app } = setup();
            const res = await app.request(
                '/api/chat/sessions/00000000-0000-0000-0000-000000099999/send',
                {
                    method: 'POST',
                    headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: 'Hello' })
                }
            );
            expect(res.status).toBe(404);
        });

        it('rejects empty content', async () => {
            const { app } = setup();
            const res = await app.request(`/api/chat/sessions/${SESSION_ID}/send`, {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '' })
            });
            expect(res.status).toBe(400);
        });

        it('rejects content exceeding 50,000 characters (SEC-020)', async () => {
            const { app } = setup();
            const res = await app.request(`/api/chat/sessions/${SESSION_ID}/send`, {
                method: 'POST',
                headers: { ...auth_headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'a'.repeat(50_001) })
            });
            expect(res.status).toBe(400);
        });
    });
});

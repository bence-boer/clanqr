import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../middleware/supabase';
import { create_mock_supabase, TEST_SEED } from '../test-utils';
import { auth_routes } from './auth';

/**
 * Auth routes are partially public (no auth middleware required).
 * We set up a minimal app without the auth middleware to test public endpoints.
 */
function setup() {
    const seed = {
        ...JSON.parse(JSON.stringify(TEST_SEED)),
        invite_tokens: [
            {
                id: '00000000-0000-0000-0000-000000000080',
                token: 'valid-invite-token',
                role: 'user',
                label: 'Test Invite',
                expires_at: '2099-12-31T23:59:59Z',
                used_at: null,
                used_by_passkey_id: null
            },
            {
                id: '00000000-0000-0000-0000-000000000081',
                token: 'used-invite-token',
                role: 'user',
                label: 'Used Invite',
                expires_at: '2099-12-31T23:59:59Z',
                used_at: '2026-01-01T00:00:00Z',
                used_by_passkey_id: 'test-passkey'
            },
            {
                id: '00000000-0000-0000-0000-000000000082',
                token: 'expired-invite-token',
                role: 'user',
                label: 'Expired Invite',
                expires_at: '2020-01-01T00:00:00Z',
                used_at: null,
                used_by_passkey_id: null
            }
        ]
    };

    const { client, store } = create_mock_supabase(seed);
    const app = new Hono<AppBindings>();

    // Inject supabase mock (no auth middleware — auth routes handle their own auth)
    app.use(
        '*',
        createMiddleware<AppBindings>(async (context, next) => {
            context.set('supabase', client);
            await next();
        })
    );

    app.route('/api/auth', auth_routes);
    return { app, store };
}

describe('auth routes', () => {
    describe('GET /api/auth/status', () => {
        it('returns setup status (passkeys exist)', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.is_setup).toBe(true);
            expect(body.authenticated).toBe(false);
        });

        it('does not auto-issue a dev session cookie', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status');
            expect(res.status).toBe(200);
            expect(res.headers.get('set-cookie')).toBeNull();
        });

        it('returns authenticated with valid session cookie', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=test-session-token' }
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.is_setup).toBe(true);
            expect(body.authenticated).toBe(true);
            expect(body.role).toBe('user');
        });

        it('returns not authenticated with invalid session', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=invalid-token' }
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(false);
        });

        it('rejects seeded dev admin sessions outside development mode', async () => {
            const { app, store } = setup();
            store.passkeys.push({
                id: 'dev-admin',
                credential_id: 'dev-admin-credential',
                public_key: 'dev-admin-key',
                counter: 0,
                device_type: 'singleDevice',
                display_name: 'Dev Admin',
                role: 'admin'
            });
            store.sessions.push({
                id: '00000000-0000-0000-0000-0000000000aa',
                passkey_id: 'dev-admin',
                token: 'dev-admin-session-token',
                expires_at: '2099-12-31T23:59:59Z'
            });

            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=dev-admin-session-token' }
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(false);
            expect(body.role).toBeNull();
            expect(body.passkey_id).toBeNull();
            expect(res.headers.get('set-cookie')).toContain('session=');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('clears session and returns success', async () => {
            const { app, store } = setup();
            const before = store.sessions.length;
            const res = await app.request('/api/auth/logout', {
                method: 'POST',
                headers: { Cookie: 'session=test-session-token' }
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.success).toBe(true);
            expect(store.sessions.length).toBe(before - 1);
        });

        it('succeeds even without session cookie', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/logout', { method: 'POST' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/register/options', () => {
        it('requires invite token when passkeys exist', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/register/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(403);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.error).toContain('already registered');
        });

        it('rejects invalid invite token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/register/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_token: 'nonexistent' })
            });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/login/options', () => {
        it('returns login options when passkeys exist', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body).toHaveProperty('challenge');
        });
    });

    describe('POST /api/auth/register/verify', () => {
        it('rejects when no challenge exists', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: {} })
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.error).toContain('challenge expired');
        });
    });

    describe('POST /api/auth/login/verify', () => {
        it('rejects when no challenge exists', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: { id: 'test' } })
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.error).toBeDefined();
        });
    });
});

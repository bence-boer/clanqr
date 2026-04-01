import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../middleware/supabase';
import { create_mock_supabase, TEST_SEED } from '../test-utils';
import { auth_routes } from './auth';

function setup() {
    const seed = { ...JSON.parse(JSON.stringify(TEST_SEED)) };
    const { client, store } = create_mock_supabase(seed);
    const app = new Hono<AppBindings>();
    app.use('*', createMiddleware<AppBindings>(async (context, next) => {
        context.set('supabase', client);
        await next();
    }));
    app.route('/api/auth', auth_routes);
    return { app, store };
}

describe('auth routes', () => {
    describe('GET /api/auth/status', () => {
        it('returns setup status (users exist)', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.is_setup).toBe(true);
            expect(body.authenticated).toBe(false);
            expect(res.headers.get('set-cookie')).toBeNull();
        });

        it('returns authenticated user object with valid session', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=test-session-token' }
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.is_setup).toBe(true);
            expect(body.authenticated).toBe(true);
            const user = body.user as Record<string, unknown>;
            expect(user.role).toBe('member');
            expect(user.username).toBe('testuser');
            for (const field of ['id', 'github_id', 'username', 'display_name', 'avatar_url', 'role']) {
                expect(user).toHaveProperty(field);
            }
        });

        it('returns not authenticated with invalid session', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=invalid-token' }
            });
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(false);
            expect(body.user).toBeNull();
        });

        it('accepts dev session tokens in non-production environments', async () => {
            // Dev tokens are allowed in development and test environments,
            // only rejected in production (NODE_ENV === 'production')
            const { app, store } = setup();
            store.users.push({
                id: 'dev-admin', github_id: 99999, username: 'dev-admin',
                display_name: 'Dev Admin', role: 'admin'
            });
            store.sessions.push({
                id: '00000000-0000-0000-0000-0000000000aa', user_id: 'dev-admin',
                token: 'dev-admin-session-token', expires_at: '2099-12-31T23:59:59Z'
            });
            const res = await app.request('/api/auth/status', {
                headers: { Cookie: 'session=dev-admin-session-token' }
            });
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(true);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('clears session and returns success', async () => {
            const { app, store } = setup();
            const before = store.sessions.length;
            const res = await app.request('/api/auth/logout', {
                method: 'POST', headers: { Cookie: 'session=test-session-token' }
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

    describe('GET /api/auth/login/github', () => {
        it('redirects to GitHub OAuth authorize URL', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/github', { redirect: 'manual' });
            expect(res.status).toBe(302);
            const location = res.headers.get('location') ?? '';
            expect(location).toContain('https://github.com/login/oauth/authorize');
            expect(location).toContain('client_id=');
            expect(location).toContain('state=');
        });

        it('sets oauth_state cookie', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/github', { redirect: 'manual' });
            expect(res.headers.get('set-cookie') ?? '').toContain('oauth_state=');
        });
    });

    describe('GET /api/auth/login/callback', () => {
        it('forwards GitHub error param (e.g. access_denied)', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/callback?error=access_denied', {
                redirect: 'manual'
            });
            expect(res.status).toBe(302);
            expect(res.headers.get('location') ?? '').toContain('auth_error=access_denied');
        });

        it('rejects callback without state parameter', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/callback?code=test', { redirect: 'manual' });
            expect(res.headers.get('location') ?? '').toContain('auth_error=invalid_state');
        });

        it('rejects callback with mismatched state', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/callback?code=test&state=wrong', {
                redirect: 'manual', headers: { Cookie: 'oauth_state=correct' }
            });
            expect(res.headers.get('location') ?? '').toContain('auth_error=invalid_state');
        });

        it('rejects callback without code', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/login/callback?state=test', {
                redirect: 'manual', headers: { Cookie: 'oauth_state=test' }
            });
            expect(res.headers.get('location') ?? '').toContain('auth_error=missing_code');
        });
    });

    describe('GET /api/auth/register/github', () => {
        it('redirects to login flow', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/register/github', { redirect: 'manual' });
            expect(res.status).toBe(302);
            expect(res.headers.get('location') ?? '').toContain('/api/auth/login/github');
        });
    });

    describe('GET /api/auth/me', () => {
        it('returns user when authenticated', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/me', {
                headers: { Cookie: 'session=test-session-token' }
            });
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(true);
            expect(body.user).toBeTruthy();
        });

        it('returns not authenticated without session', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/me');
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.authenticated).toBe(false);
            expect(body.user).toBeNull();
        });
    });
});

import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { auth_middleware } from './auth';
import { create_test_app, auth_headers, admin_headers } from '../test-app';
import { create_mock_supabase, TEST_SEED } from '../test-utils';
import { hash_session_token } from '../routes/auth_shared';
import type { AppBindings } from '../middleware/supabase';

describe('auth middleware', () => {
    describe('auth_middleware', () => {
        it('returns 401 when no session cookie is present', async () => {
            const { app } = create_test_app();
            app.get('/api/test', (c) => c.json({ ok: true }));

            const res = await app.request('/api/test');
            expect(res.status).toBe(401);
            const body = (await res.json()) as { error: string };
            expect(body.error).toBe('Authentication required');
        });

        it('returns 401 for invalid/expired session token', async () => {
            const { app } = create_test_app();
            app.get('/api/test', (c) => c.json({ ok: true }));

            const res = await app.request('/api/test', {
                headers: { Cookie: 'session=invalid-token' }
            });
            expect(res.status).toBe(401);
        });

        it('passes through with valid session cookie', async () => {
            const { app } = create_test_app();
            app.get('/api/test', (c) =>
                c.json({ user_id: c.get('user_id'), role: c.get('role') })
            );

            const res = await app.request('/api/test', {
                headers: auth_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { user_id: string, role: string };
            expect(body.user_id).toBe('test-user');
            expect(body.role).toBe('member');
        });

        it('correctly identifies admin role', async () => {
            const { app } = create_test_app();
            app.get('/api/test', (c) =>
                c.json({ role: c.get('role') })
            );

            const res = await app.request('/api/test', {
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { role: string };
            expect(body.role).toBe('admin');
        });
    });

    describe('auth_middleware (real implementation)', () => {
        it('accepts dev session tokens in non-production environments', async () => {
            // Dev tokens are allowed in test/development, only rejected in production
            const seed = JSON.parse(JSON.stringify(TEST_SEED)) as typeof TEST_SEED;
            seed.users.push({
                id: 'dev-admin',
                github_id: 99999,
                username: 'dev-admin',
                display_name: 'Dev Admin',
                role: 'admin'
            });
            seed.sessions.push({
                id: '00000000-0000-0000-0000-0000000000ab',
                user_id: 'dev-admin',
                token: hash_session_token('dev-admin-session-token'),
                expires_at: '2099-12-31T23:59:59Z'
            });

            const { client } = create_mock_supabase(seed);
            const app = new Hono<AppBindings>();
            app.use(
                '*',
                createMiddleware<AppBindings>(async (context, next) => {
                    context.set('supabase', client);
                    await next();
                })
            );
            app.use('/api/*', auth_middleware());
            app.get('/api/test', (context) => context.json({ ok: true }));

            const res = await app.request('/api/test', {
                headers: { Cookie: 'session=dev-admin-session-token' }
            });
            expect(res.status).toBe(200);
        });
    });

    describe('admin_middleware (standalone)', () => {
        it('returns 403 for non-admin users', async () => {
            const { app } = create_test_app();
            app.use(
                '/api/admin/*',
                createMiddleware<AppBindings>(async (c, next) => {
                    if (c.get('role') !== 'admin') {
                        return c.json({ error: 'Forbidden' }, 403);
                    }
                    await next();
                })
            );
            app.get('/api/admin/test', (c) => c.json({ ok: true }));

            const res = await app.request('/api/admin/test', {
                headers: auth_headers()
            });
            expect(res.status).toBe(403);
        });

        it('passes through for admin users', async () => {
            const { app } = create_test_app();
            app.use(
                '/api/admin/*',
                createMiddleware<AppBindings>(async (c, next) => {
                    if (c.get('role') !== 'admin') {
                        return c.json({ error: 'Forbidden' }, 403);
                    }
                    await next();
                })
            );
            app.get('/api/admin/test', (c) => c.json({ ok: true }));

            const res = await app.request('/api/admin/test', {
                headers: admin_headers()
            });
            expect(res.status).toBe(200);
        });
    });

    describe('public routes', () => {
        it('does not require auth for non /api/* paths', async () => {
            const { app } = create_test_app();
            app.get('/health', (c) => c.json({ status: 'ok' }));

            const res = await app.request('/health');
            expect(res.status).toBe(200);
        });
    });
});

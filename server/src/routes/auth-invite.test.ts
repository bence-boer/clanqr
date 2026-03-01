import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../middleware/supabase';
import { create_mock_supabase, TEST_SEED } from '../test-utils';
import { auth_routes } from './auth';

/**
 * Auth invite routes — tests for GET /api/auth/invite/status
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

describe('auth invite routes', () => {
    describe('GET /api/auth/invite/status', () => {
        it('returns invalid for missing token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/invite/status');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.valid).toBe(false);
            expect(body.reason).toBe('missing');
        });

        it('returns valid for a good invite token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/invite/status?token=valid-invite-token');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.valid).toBe(true);
            expect(body.role).toBe('user');
        });

        it('returns invalid for used token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/invite/status?token=used-invite-token');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.valid).toBe(false);
            expect(body.reason).toBe('used');
        });

        it('returns invalid for expired token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/invite/status?token=expired-invite-token');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.valid).toBe(false);
            expect(body.reason).toBe('expired');
        });

        it('returns invalid for non-existent token', async () => {
            const { app } = setup();
            const res = await app.request('/api/auth/invite/status?token=does-not-exist');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.valid).toBe(false);
            expect(body.reason).toBe('not_found');
        });
    });
});

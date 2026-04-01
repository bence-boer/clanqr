import type { SupabaseClient } from '@supabase/supabase-js';
import { HeadersInit } from 'bun';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppBindings } from './middleware/supabase';
import { create_mock_supabase, TEST_SEED } from './test-utils';

type MockStore = Record<string, Record<string, unknown>[]>;

/**
 * Create a test Hono app with mock Supabase middleware and auth.
 * Returns the app instance and the backing data store for assertions.
 */
export function create_test_app(seed?: MockStore): {
    app: Hono<AppBindings>
    store: MockStore
    client: SupabaseClient
} {
    const { client, store } = create_mock_supabase(seed ?? TEST_SEED);

    const app = new Hono<AppBindings>();

    // Mock supabase middleware — injects mock client
    app.use(
        '*',
        createMiddleware<AppBindings>(async (context, next) => {
            context.set('supabase', client);
            await next();
        })
    );

    // Mock auth middleware — reads session cookie like the real one
    app.use(
        '/api/*',
        createMiddleware<AppBindings>(async (context, next) => {
            const token = getCookie(context, 'session');
            if (!token) {
                return context.json({ error: 'Authentication required' }, 401);
            }

            // Look up session in mock store
            const sessions = store.sessions ?? [];
            const session = sessions.find(
                (s) => s.token === token && new Date(s.expires_at as string) > new Date()
            );
            if (!session) {
                return context.json({ error: 'Session expired' }, 401);
            }

            const users = store.users ?? [];
            const user = users.find((u) => u.id === session.user_id);

            context.set('user_id', session.user_id as string);
            context.set('role', (user?.role as string) ?? 'member');
            await next();
        })
    );

    return { app, store, client };
}

/** Helper to make a request with a session cookie */
export function auth_headers(token: string = 'test-session-token') {
    return { Cookie: `session=${token}` } as const satisfies HeadersInit;
}

export function admin_headers() {
    return { Cookie: 'session=test-admin-session-token' } as const satisfies HeadersInit;
}

import { createMiddleware } from 'hono/factory';
import { deleteCookie, getCookie } from 'hono/cookie';
import { env } from '../env';
import { is_dev_passkey_id, is_dev_session_token } from '../utils/dev_sessions';
import type { AppBindings } from './supabase';

interface SessionWithPasskey {
    id: string
    passkey_id: string
    expires_at: string
    passkeys: { role: 'admin' | 'user' } | null
}

export function auth_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        const token = getCookie(context, 'session');
        if (!token) {
            return context.json({ error: 'Authentication required' }, 401);
        }

        if (env.NODE_ENV !== 'development' && is_dev_session_token(token)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ error: 'Session expired' }, 401);
        }

        const db = context.get('supabase');

        // Single query with join to get session + role (BE-012)
        const { data: session } = await db
            .from('sessions')
            .select('id, passkey_id, expires_at, passkeys(role)')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .returns<SessionWithPasskey[]>()
            .single();

        if (!session) {
            return context.json({ error: 'Session expired' }, 401);
        }

        if (env.NODE_ENV !== 'development' && is_dev_passkey_id(session.passkey_id)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ error: 'Session expired' }, 401);
        }

        const role = session.passkeys?.role ?? 'user';
        context.set('passkey_id', session.passkey_id);
        context.set('role', role);

        await next();
    });
}

export function admin_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        if (context.get('role') !== 'admin') {
            return context.json({ error: 'Forbidden' }, 403);
        }
        await next();
    });
}

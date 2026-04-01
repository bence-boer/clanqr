import { createMiddleware } from 'hono/factory';
import { deleteCookie, getCookie } from 'hono/cookie';
import { env } from '../env';
import { is_dev_session_token, is_dev_user_id } from '../utils/dev_sessions';
import type { AppBindings } from './supabase';

interface SessionWithUser {
    id: string
    user_id: string
    expires_at: string
    users: { id: string, username: string, role: 'admin' | 'member', github_id: number } | null
}

export function auth_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        const token = getCookie(context, 'session');
        if (!token) {
            return context.json({ error: 'Authentication required' }, 401);
        }

        if (env.NODE_ENV === 'production' && is_dev_session_token(token)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ error: 'Session expired' }, 401);
        }

        const db = context.get('supabase');

        const { data: session } = await db
            .from('sessions')
            .select('id, user_id, expires_at, users(id, username, role, github_id)')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .returns<SessionWithUser[]>()
            .single();

        if (!session) {
            return context.json({ error: 'Session expired' }, 401);
        }

        if (env.NODE_ENV === 'production' && is_dev_user_id(session.user_id)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ error: 'Session expired' }, 401);
        }

        const role = session.users?.role ?? 'member';
        context.set('user_id', session.user_id);
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

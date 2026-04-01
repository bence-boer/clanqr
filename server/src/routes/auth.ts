import { Hono } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { env } from '../env';
import type { AppBindings } from '../middleware/supabase';
import { is_dev_session_token, is_dev_user_id } from '../utils/dev_sessions';
import { login_routes } from './auth_login';
import { register_routes } from './auth_register';

export const auth_routes = new Hono<AppBindings>()

    // Get current authenticated user
    .get('/me', async (context) => {
        const token = getCookie(context, 'session');
        if (!token) return context.json({ authenticated: false, user: null });

        if (env.NODE_ENV === 'production' && is_dev_session_token(token)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ authenticated: false, user: null });
        }

        const db = context.get('supabase');
        const { data: session } = await db
            .from('sessions')
            .select('id, user_id, expires_at')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!session) {
            return context.json({ authenticated: false, user: null });
        }

        if (env.NODE_ENV === 'production' && is_dev_user_id(session.user_id)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ authenticated: false, user: null });
        }

        const { data: user } = await db
            .from('users')
            .select('id, username, display_name, avatar_url, role, github_id')
            .eq('id', session.user_id)
            .single();

        if (!user) {
            return context.json({ authenticated: false, user: null });
        }

        return context.json({ authenticated: true, user });
    })

    // Auth status check
    .get('/status', async (context) => {
        const db = context.get('supabase');
        const token = getCookie(context, 'session');

        const { count } = await db
            .from('users')
            .select('*', { count: 'exact', head: true });
        const is_setup = (count ?? 0) > 0;

        if (token && env.NODE_ENV === 'production' && is_dev_session_token(token)) {
            deleteCookie(context, 'session', { path: '/' });
            return context.json({ is_setup, authenticated: false, user: null });
        }

        if (token) {
            const { data } = await db
                .from('sessions')
                .select('id, expires_at, user_id')
                .eq('token', token)
                .gt('expires_at', new Date().toISOString())
                .single();
            if (data) {
                if (env.NODE_ENV === 'production' && is_dev_user_id(data.user_id)) {
                    deleteCookie(context, 'session', { path: '/' });
                    return context.json({ is_setup, authenticated: false, user: null });
                }
                const { data: user } = await db
                    .from('users')
                    .select('id, github_id, username, display_name, avatar_url, role')
                    .eq('id', data.user_id)
                    .single();
                if (user) {
                    return context.json({ is_setup, authenticated: true, user });
                }
            }
        }

        return context.json({ is_setup, authenticated: false, user: null });
    })

    // Mount registration and login sub-routes
    .route('/register', register_routes)
    .route('/login', login_routes)

    // Logout
    .post('/logout', async (context) => {
        const db = context.get('supabase');
        const token = getCookie(context, 'session');
        if (token) {
            await db.from('sessions').delete().eq('token', token);
        }
        deleteCookie(context, 'session', { path: '/' });
        return context.json({ success: true });
    });

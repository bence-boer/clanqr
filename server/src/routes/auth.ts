import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env } from '../env';
import type { AppBindings } from '../middleware/supabase';
import { login_routes } from './auth_login';
import { register_routes } from './auth_register';

export const auth_routes = new Hono<AppBindings>();

// Check invite token status (public, no auth required)
auth_routes.get('/invite/status', async (context) => {
    const token = context.req.query('token');
    if (!token) return context.json({ valid: false, reason: 'missing' });

    const db = context.get('supabase');
    const { data: invite } = await db
        .from('invite_tokens')
        .select('role, label, expires_at, used_at')
        .eq('token', token)
        .single();

    if (!invite) return context.json({ valid: false, reason: 'not_found' });
    if (invite.used_at) return context.json({ valid: false, reason: 'used' });
    if (new Date(invite.expires_at) <= new Date()) return context.json({ valid: false, reason: 'expired' });

    return context.json({ valid: true, role: invite.role, label: invite.label, expires_at: invite.expires_at });
});

// Check if any passkeys are registered (setup status)
auth_routes.get('/status', async (context) => {
    const db = context.get('supabase');

    let token = getCookie(context, 'session');

    if (!token && env.NODE_ENV === 'development') {
        token = 'dev-admin-session-token';
        setCookie(context, 'session', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            path: '/',
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
    }

    const { count } = await db
        .from('passkeys')
        .select('*', { count: 'exact', head: true });
    const is_setup = (count ?? 0) > 0;

    let authenticated = false;
    let role: string | null = null;
    let passkey_id: string | null = null;
    if (token) {
        const { data } = await db
            .from('sessions')
            .select('id, expires_at, passkey_id')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .single();
        if (data) {
            authenticated = true;
            passkey_id = data.passkey_id;
            const { data: passkey } = await db
                .from('passkeys')
                .select('role')
                .eq('id', data.passkey_id)
                .single();
            role = passkey?.role ?? null;
        }
    }

    return context.json({ is_setup, authenticated, role, passkey_id });
});

// Mount registration and login sub-routes
auth_routes.route('/register', register_routes);
auth_routes.route('/login', login_routes);

// Logout
auth_routes.post('/logout', async (context) => {
    const db = context.get('supabase');
    const token = getCookie(context, 'session');
    if (token) {
        await db.from('sessions').delete().eq('token', token);
    }
    deleteCookie(context, 'session', { path: '/' });
    return context.json({ success: true });
});

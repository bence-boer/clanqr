import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppBindings } from '../middleware/supabase';
import { env } from '../env';
import { generate_session_token } from './auth_shared';
import { encrypt_token } from '../utils/token_encryption';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

function get_admin_github_ids(): Set<number> {
    return new Set(
        (env.ADMIN_GITHUB_IDS ?? '').split(',').filter(Boolean).map(Number)
    );
}

export const login_routes = new Hono<AppBindings>()

    // GET /api/auth/login/github → Redirect to GitHub authorization
    .get('/github', async (context) => {
        const state = generate_session_token();
        setCookie(context, 'oauth_state', state, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'Lax',
            path: '/',
            maxAge: 600
        });
        const params = new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID,
            redirect_uri: env.GITHUB_CALLBACK_URL,
            scope: 'read:user user:email',
            state
        });
        return context.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
    })

    // GET /api/auth/login/callback → Exchange code, create session, redirect
    .get('/callback', async (context) => {
        const db = context.get('supabase');
        const code = context.req.query('code');
        const state = context.req.query('state');
        const stored_state = getCookie(context, 'oauth_state');
        const oauth_error = context.req.query('error');

        // GitHub sends ?error=access_denied when user declines
        if (oauth_error) {
            setCookie(context, 'oauth_state', '', { maxAge: 0, path: '/' });
            return context.redirect(`${env.FRONTEND_URL}?auth_error=${oauth_error}`);
        }

        // Validate state parameter (CSRF protection)
        if (!state || !stored_state || state !== stored_state) {
            return context.redirect(`${env.FRONTEND_URL}?auth_error=invalid_state`);
        }

        // Clear state cookie
        setCookie(context, 'oauth_state', '', { maxAge: 0, path: '/' });

        if (!code) {
            return context.redirect(`${env.FRONTEND_URL}?auth_error=missing_code`);
        }

        // Exchange code for access token
        let token_data: { access_token?: string, token_type?: string, scope?: string, error?: string };
        try {
            const token_response = await fetch(GITHUB_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: env.GITHUB_CLIENT_ID,
                    client_secret: env.GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: env.GITHUB_CALLBACK_URL
                })
            });
            token_data = await token_response.json() as typeof token_data;
        }
        catch {
            return context.redirect(`${env.FRONTEND_URL}?auth_error=token_exchange_failed`);
        }

        if (!token_data.access_token) {
            return context.redirect(`${env.FRONTEND_URL}?auth_error=no_access_token`);
        }

        // Fetch GitHub user profile
        let github_user: {
            id: number
            login: string
            name: string | null
            avatar_url: string
            email: string | null
        };
        try {
            const user_response = await fetch(GITHUB_USER_URL, {
                headers: { Authorization: `Bearer ${token_data.access_token}` }
            });
            if (!user_response.ok) {
                return context.redirect(`${env.FRONTEND_URL}?auth_error=profile_fetch_failed`);
            }
            github_user = await user_response.json() as typeof github_user;
        }
        catch {
            return context.redirect(`${env.FRONTEND_URL}?auth_error=profile_fetch_failed`);
        }

        // Determine role
        const role = get_admin_github_ids().has(github_user.id) ? 'admin' : 'member';

        // Upsert user
        const { data: user, error: upsert_error } = await db
            .from('users')
            .upsert(
                {
                    github_id: github_user.id,
                    username: github_user.login,
                    display_name: github_user.name ?? github_user.login,
                    avatar_url: github_user.avatar_url,
                    email: github_user.email,
                    role,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'github_id' }
            )
            .select('id')
            .single();

        if (upsert_error || !user) {
            console.error('User upsert failed:', upsert_error);
            return context.redirect(`${env.FRONTEND_URL}?auth_error=user_creation_failed`);
        }

        // Create session with encrypted token
        const session_token = generate_session_token();
        const encrypted_access_token = encrypt_token(token_data.access_token, env.SESSION_SECRET);
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const { error: session_error } = await db.from('sessions').insert({
            user_id: user.id,
            token: session_token,
            github_access_token: encrypted_access_token,
            expires_at: expires_at.toISOString()
        });

        if (session_error) {
            console.error('Session creation failed:', session_error);
            return context.redirect(`${env.FRONTEND_URL}?auth_error=session_creation_failed`);
        }

        // Set session cookie
        setCookie(context, 'session', session_token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'Lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60
        });

        return context.redirect(env.FRONTEND_URL);
    });

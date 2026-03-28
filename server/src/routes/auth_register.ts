import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';

export const register_routes = new Hono<AppBindings>()
    .get('/github', (context) => {
        // Registration is handled by the login flow (auto-creates user on first login)
        return context.redirect('/api/auth/login/github');
    });

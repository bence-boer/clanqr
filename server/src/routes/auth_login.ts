import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';

export const login_routes = new Hono<AppBindings>()

    .post('/options', async (context) => {
        return context.json({ error: 'GitHub OAuth not yet implemented' }, 501);
    })

    .post('/verify', async (context) => {
        return context.json({ error: 'GitHub OAuth not yet implemented' }, 501);
    });

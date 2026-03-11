import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';
import { get_activity_feed } from '../services/activity_service';
import { logger } from '../utils/logger';

export const activity_routes = new Hono<AppBindings>()

    .get('/feed', async (context) => {
        const supabase = context.get('supabase');
        const limit = Math.min(parseInt(context.req.query('limit') || '20'), 50);
        try {
            const events = await get_activity_feed(supabase, isNaN(limit) ? 20 : limit);
            return context.json(events);
        }
        catch (error) {
            logger.error('Failed to fetch activity feed', { route: 'GET /api/activity/feed', error: String(error) });
            return context.json({ error: 'Failed to fetch activity feed' }, 500);
        }
    });

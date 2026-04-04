import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';
import { get_system_stats, get_models, check_system_alerts } from '../services/system_service';
import { get_sdk_defaults } from '../services/settings_service';

export const system_routes = new Hono<AppBindings>()

    .get('/stats', async (context) => {
        const stats = await get_system_stats();
        return context.json(stats);
    })

    .get('/alerts', async (context) => {
        const stats = await get_system_stats();
        const alerts = check_system_alerts(stats);
        return context.json({ alerts });
    })

    .get('/models', async (context) => {
        const models = await get_models();
        return context.json(models);
    })

    .get('/defaults', async (context) => {
        const supabase = context.get('supabase');
        const defaults = await get_sdk_defaults(supabase);
        return context.json(defaults);
    });

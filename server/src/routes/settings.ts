/** Admin settings routes — system-wide SDK defaults and configuration. */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { get_sdk_defaults, update_sdk_defaults } from '../services/settings_service';
import { logger } from '../utils/logger';

const update_schema = z.object({
    default_model: z.string().min(1).max(100).optional(),
    default_reasoning_effort: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
    default_timeout_minutes: z.number().int().min(1).max(1440).optional(),
    max_concurrent_sessions: z.number().int().min(1).max(20).optional(),
    cost_per_premium_request: z.number().min(0).max(10).optional()
});

export const settings_routes = new Hono<AppBindings>()
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const defaults = await get_sdk_defaults(supabase);
        return context.json(defaults);
    })
    .put('/', async (context) => {
        const supabase = context.get('supabase');
        const body = await context.req.json();
        const parsed = update_schema.safeParse(body);
        if (!parsed.success) {
            return context.json({ error: 'Invalid settings', details: parsed.error.issues }, 400);
        }
        try {
            const updated = await update_sdk_defaults(supabase, parsed.data);
            return context.json(updated);
        }
        catch (err) {
            logger.error('Settings update failed', { error: String(err) });
            return context.json({ error: 'Failed to save settings' }, 500);
        }
    });

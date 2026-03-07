import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { get_usage_summary, get_usage_breakdown } from '../services/usage_service';
import { logger } from '../utils/logger';

const history_query_schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(['manager', 'ralph', 'chat']).optional(),
    status: z.enum(['completed', 'failed', 'running']).optional()
});

export const usage_routes = new Hono<AppBindings>()

    // Aggregate summary stats
    .get('/summary', async (context) => {
        const supabase = context.get('supabase');
        try {
            const summary = await get_usage_summary(supabase);
            return context.json(summary);
        }
        catch (error) {
            logger.error('Failed to fetch usage summary', { route: 'GET /api/usage/summary', error: String(error) });
            return context.json({ error: 'Failed to fetch usage summary' }, 500);
        }
    })

    // Paginated run history
    .get('/history', async (context) => {
        const supabase = context.get('supabase');
        const parsed = history_query_schema.safeParse({
            page: context.req.query('page') ?? '1',
            per_page: context.req.query('per_page') ?? '20',
            type: context.req.query('type') || undefined,
            status: context.req.query('status') || undefined
        });

        if (!parsed.success) {
            return context.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, 400);
        }

        const { page, per_page, type: type_filter, status: status_filter } = parsed.data;
        const offset = (page - 1) * per_page;

        let query = supabase
            .from('agent_runs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + per_page - 1);

        if (type_filter) query = query.eq('type', type_filter);
        if (status_filter) query = query.eq('status', status_filter);

        const { data, count, error } = await query;
        if (error) {
            logger.error('Failed to fetch history', { route: 'GET /api/usage/history', error: String(error) });
            return context.json({ error: 'Failed to fetch history' }, 500);
        }

        return context.json({
            runs: data ?? [],
            total: count ?? 0,
            page,
            per_page,
            total_pages: Math.ceil((count ?? 0) / per_page)
        });
    })

    // Usage breakdown by type and model
    .get('/breakdown', async (context) => {
        const supabase = context.get('supabase');
        try {
            const breakdown = await get_usage_breakdown(supabase);
            return context.json(breakdown);
        }
        catch (error) {
            logger.error('Failed to fetch breakdown', { route: 'GET /api/usage/breakdown', error: String(error) });
            return context.json({ error: 'Failed to fetch breakdown' }, 500);
        }
    });

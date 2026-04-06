import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { logger } from '../utils/logger';

const add_dependency_schema = z.object({
    depends_on_task_id: z.string().uuid()
});

export const task_dependency_routes = new Hono<AppBindings>()

    // Get task dependencies
    .get('/:id/dependencies', validate_uuid_params('id'), async (context) => {
        const task_id = require_param(context, 'id');
        const supabase = context.get('supabase');
        const { data } = await supabase.from('task_dependencies')
            .select('*')
            .eq('task_id', task_id);
        return context.json(data ?? []);
    })

    // Add dependency
    .post('/:id/dependencies', validate_uuid_params('id'), async (context) => {
        const task_id = require_param(context, 'id');
        const body = add_dependency_schema.safeParse(await context.req.json());
        if (!body.success) {
            return context.json({ error: 'Invalid request body' }, 400);
        }
        const { depends_on_task_id } = body.data;
        const supabase = context.get('supabase');

        const { data, error } = await supabase.from('task_dependencies')
            .insert({ task_id, depends_on_task_id })
            .select()
            .single();

        if (error) {
            logger.error('Failed to add dependency', { route: 'POST /api/tasks/:id/dependencies', task_id, error: error.message });
            return context.json({ error: 'Failed to add dependency' }, 400);
        }
        return context.json(data, 201);
    })

    // Remove dependency
    .delete('/:id/dependencies/:dep_id', validate_uuid_params('id', 'dep_id'), async (context) => {
        const task_id = require_param(context, 'id');
        const dep_id = context.req.param('dep_id');
        const supabase = context.get('supabase');

        await supabase.from('task_dependencies')
            .delete()
            .eq('task_id', task_id)
            .eq('depends_on_task_id', dep_id);

        return context.json({ success: true });
    });

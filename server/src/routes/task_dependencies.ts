import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';

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
        const { depends_on_task_id } = await context.req.json();
        const supabase = context.get('supabase');

        const { data, error } = await supabase.from('task_dependencies')
            .insert({ task_id, depends_on_task_id })
            .select()
            .single();

        if (error) return context.json({ error: error.message }, 400);
        return context.json(data, 201);
    })

    // Remove dependency
    .delete('/:id/dependencies/:dep_id', validate_uuid_params('id'), async (context) => {
        const task_id = require_param(context, 'id');
        const dep_id = context.req.param('dep_id');
        const supabase = context.get('supabase');

        await supabase.from('task_dependencies')
            .delete()
            .eq('task_id', task_id)
            .eq('depends_on_task_id', dep_id);

        return context.json({ success: true });
    });

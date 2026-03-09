import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { pipeline_service } from '../services/pipeline_service';
import { event_bus } from '../services/event_bus';
import { logger } from '../utils/logger';
import { task_artifact_routes } from './task_artifacts';
import type { Enums } from '../database.types';

const update_task_schema = z.object({
    status: z
        .enum(['Pending_Approval', 'Approved', 'In_Progress', 'Complete'])
        .optional(),
    title: z.string().nullable().optional(),
    description: z.string().optional(),
    agent_log: z.string().optional(),
    model: z.string().nullable().optional()
});

const create_task_schema = z.object({
    feature_id: z.string().uuid(),
    description: z.string().min(1),
    sort_order: z.number().int().optional(),
    model: z.string().nullable().optional()
});

export const tasks_routes = new Hono<AppBindings>()

    // List tasks (optionally filter by feature or status)
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const feature_id = context.req.query('feature_id');
        const status = context.req.query('status');

        let query = supabase
            .from('tasks')
            .select('*, features(id, title, project_id, projects(id, name))')
            .order('created_at', { ascending: true });

        if (feature_id) {
            query = query.eq('feature_id', feature_id);
        }
        if (status) {
            query = query.eq('status', status as Enums<'task_status'>);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to fetch tasks', { route: 'GET /api/tasks', error: String(error) });
            return context.json({ error: 'Failed to fetch tasks' }, 500);
        }
        return context.json(data);
    })

    // Get single task
    .get('/:id', validate_uuid_params('id'), async (context) => {
        const supabase = context.get('supabase');
        const id = context.req.param('id');

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            logger.error('Task not found', { route: 'GET /api/tasks/:id', id, error: String(error) });
            return context.json({ error: 'Task not found' }, 404);
        }
        return context.json(data);
    })

    // Update task
    .patch('/:id', validate_uuid_params('id'), zValidator('json', update_task_schema), async (context) => {
        const id = context.req.param('id');
        const parsed = context.req.valid('json');

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('tasks')
            .update(parsed)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update task', { route: 'PATCH /api/tasks/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update task' }, 500);
        }

        if (parsed.status === 'Approved') {
            pipeline_service.process_next().catch((err) => logger.error('Pipeline process_next error', { error: String(err) }));
        }

        return context.json(data);
    })

    // Approve task
    .post('/:id/approve', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        // Check current task state first
        const { data: current_task, error: fetch_error } = await supabase
            .from('tasks')
            .select('id, status')
            .eq('id', id)
            .single();

        if (fetch_error || !current_task) {
            return context.json({ error: 'Task not found' }, 404);
        }

        if (current_task.status === 'Approved' || current_task.status === 'In_Progress' || current_task.status === 'Complete') {
        // Already approved or beyond — return current state
            const { data } = await supabase.from('tasks').select('*').eq('id', id).single();
            return context.json(data);
        }

        if (current_task.status !== 'Pending_Approval') {
            return context.json({ error: `Cannot approve task in '${current_task.status}' state` }, 409);
        }

        const { data, error } = await supabase
            .from('tasks')
            .update({ status: 'Approved' })
            .eq('id', id)
            .eq('status', 'Pending_Approval')
            .select()
            .single();

        if (error) {
            logger.error('Failed to approve task', { route: 'POST /api/tasks/:id/approve', id, error: String(error) });
            return context.json({ error: 'Failed to approve task' }, 500);
        }
        if (data) {
            event_bus.emit({ type: 'tasks:update', data: { task_id: id, feature_id: data.feature_id, status: 'Approved' } });
        }
        pipeline_service.process_next().catch((err) => logger.error('Pipeline process_next error', { error: String(err) }));
        return context.json(data);
    })

    // Manually trigger pipeline to run a specific approved task
    .post('/:id/run', validate_uuid_params('id'), (context) => {
        pipeline_service.process_next().catch((err) => logger.error('Pipeline process_next error', { error: String(err) }));
        return context.json({ success: true });
    })

    // Bulk approve all tasks for a feature
    .post('/approve-all/:feature_id', validate_uuid_params('feature_id'), async (context) => {
        const feature_id = context.req.param('feature_id');
        const supabase = context.get('supabase');

        const { data, error } = await supabase
            .from('tasks')
            .update({ status: 'Approved' })
            .eq('feature_id', feature_id)
            .eq('status', 'Pending_Approval')
            .select();

        if (error) {
            logger.error('Failed to approve tasks', { route: 'POST /api/tasks/approve-all/:feature_id', feature_id, error: String(error) });
            return context.json({ error: 'Failed to approve tasks' }, 500);
        }

        if (data) {
            for (const task of data) {
                event_bus.emit({ type: 'tasks:update', data: { task_id: task.id, feature_id, status: 'Approved' } });
            }
        }

        // Kick pipeline
        pipeline_service.process_next().catch((err) => logger.error('Pipeline process_next error', { error: String(err) }));
        return context.json(data);
    })

    // Create a task manually
    .post('/', zValidator('json', create_task_schema), async (context) => {
        const parsed = context.req.valid('json');

        const supabase = context.get('supabase');

        // Verify feature exists before inserting
        const { data: feature } = await supabase
            .from('features')
            .select('id')
            .eq('id', parsed.feature_id)
            .single();

        if (!feature) {
            return context.json({ error: 'Feature not found' }, 404);
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert({ ...parsed, status: 'Pending_Approval' })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create task', { route: 'POST /api/tasks', error: String(error) });
            return context.json({ error: 'Failed to create task' }, 500);
        }
        if (data) {
            event_bus.emit({ type: 'tasks:update', data: { task_id: data.id, feature_id: data.feature_id, status: data.status } });
        }
        return context.json(data, 201);
    })

    // Delete a task (only if not in-progress or complete)
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data: task, error: fetch_error } = await supabase
            .from('tasks')
            .select('status')
            .eq('id', id)
            .single();

        if (fetch_error) {
            logger.error('Task not found', { route: 'DELETE /api/tasks/:id', id, error: String(fetch_error) });
            return context.json({ error: 'Task not found' }, 404);
        }
        if (!['Pending_Approval', 'Approved'].includes(task.status)) {
            return context.json({ error: 'Cannot delete a task that is in progress or complete' }, 409);
        }

        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) {
            logger.error('Failed to delete task', { route: 'DELETE /api/tasks/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete task' }, 500);
        }
        return context.json({ success: true });
    })

    // Artifact routes (list files, download file)
    .route('/', task_artifact_routes);

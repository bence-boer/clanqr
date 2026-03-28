import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { resolve_task_traits, resolve_scope_traits } from '../services/trait_service';
import { logger } from '../utils/logger';
import type { Enums } from '../database.types';

const create_trait_schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    target: z.enum(['manager', 'ralph', 'researcher', 'editor', 'chat', 'custom']),
    content: z.string().min(1),
    is_global: z.boolean().default(false)
});

const update_trait_schema = create_trait_schema.partial();

const assign_schema = z.object({
    trait_id: z.string().uuid(),
    scope: z.enum(['project', 'feature', 'task']),
    project_id: z.string().uuid().optional(),
    feature_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    is_excluded: z.boolean().default(false),
    assigned_by: z.string().default('user')
});

export const traits_routes = new Hono<AppBindings>()

    // List all traits
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const target = context.req.query('target');

        let query = supabase.from('traits').select('*').order('name');
        if (target === 'manager' || target === 'ralph') {
            query = query.eq('target', target);
        }

        const { data, error } = await query;
        if (error) {
            logger.error('Failed to fetch traits', { route: 'GET /api/traits', error: String(error) });
            return context.json({ error: 'Failed to fetch traits' }, 500);
        }
        return context.json(data);
    })

    // Create trait
    .post('/', zValidator('json', create_trait_schema), async (context) => {
        const parsed = context.req.valid('json');

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('traits')
            .insert(parsed)
            .select('*')
            .single();

        if (error) {
            logger.error('Failed to create trait', { route: 'POST /api/traits', error: String(error) });
            return context.json({ error: 'Failed to create trait' }, 500);
        }
        return context.json(data, 201);
    })

    // Assign trait to a scope — must come before /:id to avoid conflict
    // List assignments (filtered by scope + ID)
    .get('/assign', async (context) => {
        const supabase = context.get('supabase');
        const { scope, task_id, feature_id, project_id } = context.req.query();
        let query = supabase.from('trait_assignments').select('*');
        if (scope) query = query.eq('scope', scope as Enums<'assignment_scope'>);
        if (task_id) query = query.eq('task_id', task_id);
        if (feature_id) query = query.eq('feature_id', feature_id);
        if (project_id) query = query.eq('project_id', project_id);
        const { data, error } = await query;
        if (error) {
            logger.error('Failed to fetch assignments', { route: 'GET /api/traits/assign', error: String(error) });
            return context.json({ error: 'Failed to fetch assignments' }, 500);
        }
        return context.json(data);
    })

    .post('/assign', zValidator('json', assign_schema), async (context) => {
        const parsed = context.req.valid('json');

        const { scope, project_id, feature_id, task_id } = parsed;

        // Validate scope matches provided IDs
        if (scope === 'project' && !project_id) {
            return context.json({ error: 'project_id required for project scope' }, 400);
        }
        if (scope === 'feature' && !feature_id) {
            return context.json({ error: 'feature_id required for feature scope' }, 400);
        }
        if (scope === 'task' && !task_id) {
            return context.json({ error: 'task_id required for task scope' }, 400);
        }

        const supabase = context.get('supabase');

        // Verify referenced entities exist
        if (project_id) {
            const { data: proj } = await supabase.from('projects').select('id').eq('id', project_id).single();
            if (!proj) return context.json({ error: 'Project not found' }, 404);
        }
        if (feature_id) {
            const { data: feat } = await supabase.from('features').select('id').eq('id', feature_id).single();
            if (!feat) return context.json({ error: 'Feature not found' }, 404);
        }
        if (task_id) {
            const { data: tsk } = await supabase.from('tasks').select('id').eq('id', task_id).single();
            if (!tsk) return context.json({ error: 'Task not found' }, 404);
        }

        const { data, error } = await supabase
            .from('trait_assignments')
            .insert(parsed)
            .select('*')
            .single();

        if (error) {
            logger.error('Failed to assign trait', { route: 'POST /api/traits/assign', error: String(error) });
            return context.json({ error: 'Failed to assign trait' }, 500);
        }
        return context.json(data, 201);
    })

    // Resolve effective traits for a task (walks inheritance chain)
    .get('/resolve/:task_id', validate_uuid_params('task_id'), async (context) => {
        const task_id = context.req.param('task_id');
        const supabase = context.get('supabase');

        const resolved = await resolve_task_traits(supabase, task_id, 'ralph');
        return context.json(resolved);
    })

    // Resolve effective traits for a feature
    .get('/resolve/feature/:id', validate_uuid_params('id'), async (context) => {
        const feature_id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data: feature, error } = await supabase
            .from('features')
            .select('id, project_id')
            .eq('id', feature_id)
            .single();

        if (error || !feature) return context.json({ error: 'Feature not found' }, 404);

        const resolved = await resolve_scope_traits(supabase, {
            scope: 'feature',
            feature_id,
            project_id: feature.project_id
        });

        return context.json(resolved);
    })

    // Get trait by ID
    .get('/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data, error } = await supabase
            .from('traits')
            .select('*, trait_assignments(id)')
            .eq('id', id)
            .single();

        if (error || !data) return context.json({ error: 'Trait not found' }, 404);
        return context.json({ ...data, assignment_count: data.trait_assignments?.length ?? 0 });
    })

    // Update trait
    .patch('/:id', validate_uuid_params('id'), zValidator('json', update_trait_schema), async (context) => {
        const id = context.req.param('id');
        const result = context.req.valid('json');

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('traits')
            .update({ ...result, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();

        if (error || !data) return context.json({ error: 'Trait not found' }, 404);
        return context.json(data);
    })

    // Delete trait
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('traits').delete().eq('id', id);
        if (error) {
            logger.error('Failed to delete trait', { route: 'DELETE /api/traits/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete trait' }, 500);
        }
        return context.json({ success: true });
    })

    // Remove assignment
    .delete('/assign/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('trait_assignments').delete().eq('id', id);
        if (error) {
            logger.error('Failed to remove assignment', { route: 'DELETE /api/traits/assign/:id', id, error: String(error) });
            return context.json({ error: 'Failed to remove assignment' }, 500);
        }
        return context.json({ success: true });
    });

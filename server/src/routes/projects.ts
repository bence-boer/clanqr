import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { logger } from '../utils/logger';

const create_project_schema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().nullable().optional()
});

const update_project_schema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(['active', 'archived', 'planning']).optional()
});

export const projects_routes = new Hono<AppBindings>()

    // List all projects
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to fetch projects', { route: 'GET /api/projects', error: String(error) });
            return context.json({ error: 'Failed to fetch projects' }, 500);
        }
        return context.json(data);
    })

    // Get single project with features
    .get('/:id', validate_uuid_params('id'), async (context) => {
        const supabase = context.get('supabase');
        const id = require_param(context, 'id');

        const { data, error } = await supabase
            .from('projects')
            .select('*, features(*, tasks(*), resources(*))')
            .eq('id', id)
            .single();

        if (error) {
            logger.error('Project not found', { route: 'GET /api/projects/:id', id, error: String(error) });
            return context.json({ error: 'Project not found' }, 404);
        }
        return context.json(data);
    })

    // Create project
    .post('/', async (context) => {
        const body = await context.req.json();
        const parsed = create_project_schema.safeParse(body);

        if (!parsed.success) {
            return context.json({ error: parsed.error.flatten() }, 400);
        }

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('projects')
            .insert(parsed.data)
            .select()
            .single();

        if (error) {
            logger.error('Failed to create project', { route: 'POST /api/projects', error: String(error) });
            return context.json({ error: 'Failed to create project' }, 500);
        }
        return context.json(data, 201);
    })

    // Update project
    .patch('/:id', validate_uuid_params('id'), zValidator('json', update_project_schema), async (context) => {
        const id = require_param(context, 'id');
        const parsed = context.req.valid('json');

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('projects')
            .update(parsed)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update project', { route: 'PATCH /api/projects/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update project' }, 500);
        }
        return context.json(data);
    })

    // Delete project
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('projects').delete().eq('id', id);

        if (error) {
            logger.error('Failed to delete project', { route: 'DELETE /api/projects/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete project' }, 500);
        }

        return context.json({ success: true });
    });

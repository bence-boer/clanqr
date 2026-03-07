import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { validate_resource_url } from '../utils/ssrf';
import { logger } from '../utils/logger';

const create_feature_schema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).nullable().optional(),
    cli: z.string().default('copilot'),
    planning_model: z.string().min(1, 'Planning model is required'),
    execution_model: z.string().min(1, 'Execution model is required'),
    resources: z
        .array(z.object({ url: z.string().url(), title: z.string().optional() }))
        .optional()
});

const update_feature_schema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(['Draft', 'Submitted', 'In_Progress', 'Done']).optional(),
    cli: z.string().optional(),
    planning_model: z.string().nullable().optional(),
    execution_model: z.string().nullable().optional()
});

export const features_routes = new Hono<AppBindings>()

    // List features (optionally filter by project)
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const project_id = context.req.query('project_id');

        let query = supabase
            .from('features')
            .select('*, resources(*), tasks(*)')
            .order('created_at', { ascending: false });

        if (project_id) {
            query = query.eq('project_id', project_id);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to fetch features', { route: 'GET /api/features', error: String(error) });
            return context.json({ error: 'Failed to fetch features' }, 500);
        }
        return context.json(data);
    })

    // Get single feature with resources and tasks
    .get('/:id', validate_uuid_params('id'), async (context) => {
        const supabase = context.get('supabase');
        const id = context.req.param('id');

        const { data, error } = await supabase
            .from('features')
            .select('*, resources(*), tasks(*)')
            .eq('id', id)
            .single();

        if (error) {
            logger.error('Feature not found', { route: 'GET /api/features/:id', id, error: String(error) });
            return context.json({ error: 'Feature not found' }, 404);
        }
        return context.json(data);
    })

    // Create feature (with optional resources)
    .post('/', async (context) => {
        const body = await context.req.json();
        const parsed = create_feature_schema.safeParse(body);

        if (!parsed.success) {
            return context.json({ error: parsed.error.flatten() }, 400);
        }

        const supabase = context.get('supabase');
        const { resources, ...feature_data } = parsed.data;

        const { data: feature, error: feature_error } = await supabase
            .from('features')
            .insert(feature_data)
            .select()
            .single();

        if (feature_error) {
            logger.error('Failed to create feature', { route: 'POST /api/features', error: String(feature_error) });
            return context.json({ error: 'Failed to create feature' }, 500);
        }

        if (resources && resources.length > 0) {
            const invalid_url = resources.find((r) => !validate_resource_url(r.url));
            if (invalid_url) {
                return context.json({ error: 'Invalid resource URL: internal or non-HTTP(S) URLs are not allowed' }, 400);
            }
            const resource_rows = resources.map((r) => ({
                feature_id: feature.id,
                url: r.url,
                title: r.title
            }));
            await supabase.from('resources').insert(resource_rows);
        }

        const { data: full_feature } = await supabase
            .from('features')
            .select('*, resources(*), tasks(*)')
            .eq('id', feature.id)
            .single();

        return context.json(full_feature, 201);
    })

    // Update feature
    .patch('/:id', validate_uuid_params('id'), zValidator('json', update_feature_schema), async (context) => {
        const id = context.req.param('id');
        const parsed = context.req.valid('json');

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('features')
            .update(parsed)
            .eq('id', id)
            .select('*, resources(*), tasks(*)')
            .single();

        if (error) {
            logger.error('Failed to update feature', { route: 'PATCH /api/features/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update feature' }, 500);
        }
        return context.json(data);
    })

    // Submit feature for implementation
    .post('/:id/submit', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        // Validate that models are set before allowing submission
        const { data: feature_check } = await supabase.from('features').select('planning_model, execution_model').eq('id', id).single();
        if (!feature_check?.planning_model || !feature_check?.execution_model) {
            return context.json({ error: 'Planning model and execution model must be set before submitting' }, 400);
        }

        const { data, error } = await supabase
            .from('features')
            .update({ status: 'Submitted' })
            .eq('id', id)
            .select('*, resources(*), tasks(*)')
            .single();

        if (error) {
            logger.error('Failed to submit feature', { route: 'POST /api/features/:id/submit', id, error: String(error) });
            return context.json({ error: 'Failed to submit feature' }, 500);
        }
        return context.json(data);
    })

    // Delete feature
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('features').delete().eq('id', id);

        if (error) {
            logger.error('Failed to delete feature', { route: 'DELETE /api/features/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete feature' }, 500);
        }
        return context.json({ success: true });
    })

    // Add resource to feature
    .post('/:id/resources', validate_uuid_params('id'), zValidator('json', z.object({ url: z.string().url(), title: z.string().optional() })), async (context) => {
        const feature_id = context.req.param('id');
        const parsed = context.req.valid('json');

        if (!validate_resource_url(parsed.url)) {
            return context.json({ error: 'Invalid resource URL: internal or non-HTTP(S) URLs are not allowed' }, 400);
        }

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('resources')
            .insert({ feature_id, ...parsed })
            .select()
            .single();

        if (error) {
            logger.error('Failed to add resource', { route: 'POST /api/features/:id/resources', feature_id, error: String(error) });
            return context.json({ error: 'Failed to add resource' }, 500);
        }
        return context.json(data, 201);
    })

    // Delete resource
    .delete('/:feature_id/resources/:id', validate_uuid_params('feature_id', 'id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('resources').delete().eq('id', id);

        if (error) {
            logger.error('Failed to delete resource', { route: 'DELETE /api/features/resources/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete resource' }, 500);
        }
        return context.json({ success: true });
    });

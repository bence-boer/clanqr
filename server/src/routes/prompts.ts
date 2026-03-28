import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { prompt_service } from '../services/prompt_service';
import { logger } from '../utils/logger';
import type { Enums } from '../database.types';

const update_schema = z.object({ content: z.string().min(1) });
const agent_type_schema = z.enum(['manager', 'ralph', 'researcher', 'editor', 'chat', 'custom']);

export const prompts_routes = new Hono<AppBindings>()

    // List all prompts
    .get('/', async (context) => {
        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .order('agent_type');

        if (error) {
            logger.error('Failed to fetch prompts', { route: 'GET /api/prompts', error: String(error) });
            return context.json({ error: 'Failed to fetch prompts' }, 500);
        }
        return context.json(data);
    })

    // Re-sync prompts from repo files (before /:role to avoid conflict)
    .post('/sync', async (context) => {
        await prompt_service.sync_from_repo();
        return context.json({ success: true, message: 'Prompts synced from repo' });
    })

    // Get prompt by agent_type
    .get('/:role', async (context) => {
        const role = context.req.param('role');
        if (!agent_type_schema.safeParse(role).success) {
            return context.json({ error: 'Invalid agent_type' }, 400);
        }
        const supabase = context.get('supabase');

        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('agent_type', role as Enums<'agent_type'>)
            .single();

        if (error || !data) return context.json({ error: 'Prompt not found' }, 404);
        return context.json(data);
    })

    // Update prompt text
    .patch('/:role', zValidator('json', update_schema), async (context) => {
        const role = context.req.param('role');
        const parsed = context.req.valid('json');

        if (!agent_type_schema.safeParse(role).success) {
            return context.json({ error: 'Invalid agent_type' }, 400);
        }

        const ok = await prompt_service.update_prompt(role, parsed.content);
        if (!ok) return context.json({ error: 'Failed to update prompt' }, 500);

        const supabase = context.get('supabase');
        const { data } = await supabase
            .from('prompts')
            .select('*')
            .eq('agent_type', role as Enums<'agent_type'>)
            .single();

        return context.json(data);
    });

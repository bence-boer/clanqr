import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { skill_service } from '../services/skill_service';
import { logger } from '../utils/logger';

const link_schema = z.object({
    task_id: z.string().uuid(),
    skill_name: z.string().min(1)
});

export const skills_routes = new Hono<AppBindings>()

    // List all available Copilot CLI skills (scanned from ~/.copilot/skills/)
    .get('/', async (context) => {
        const skills = await skill_service.list_skills();
        // Omit full content from list — content is large
        return context.json(
            skills.map((skill) => ({
                name: skill.name,
                description: skill.description,
                path: skill.path
            }))
        );
    })

    // Refresh skill cache
    .post('/refresh', async (context) => {
        const skills = await skill_service.refresh_cache();
        return context.json({ refreshed: skills.length });
    })

    // Get skills linked to a specific task — must come before /:name to avoid conflict
    .get('/task/:task_id', validate_uuid_params('task_id'), async (context) => {
        const task_id = context.req.param('task_id');
        const supabase = context.get('supabase');

        const { data, error } = await supabase
            .from('skill_links')
            .select('*')
            .eq('task_id', task_id)
            .order('created_at');

        if (error) {
            logger.error('Failed to fetch task skills', { route: 'GET /api/skills/task/:task_id', task_id, error: String(error) });
            return context.json({ error: 'Failed to fetch task skills' }, 500);
        }
        return context.json(data ?? []);
    })

    // Link a skill to a task
    .post('/link', async (context) => {
        const result = link_schema.safeParse(await context.req.json());
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const { task_id, skill_name } = result.data;

        // Verify the skill actually exists
        const skill = await skill_service.get_skill(skill_name);
        if (!skill) return context.json({ error: `Skill '${skill_name}' not found` }, 404);

        // Verify the task exists
        const supabase = context.get('supabase');
        const { data: task } = await supabase.from('tasks').select('id').eq('id', task_id).single();
        if (!task) return context.json({ error: 'Task not found' }, 404);

        const { data, error } = await supabase
            .from('skill_links')
            .insert({ task_id, skill_name })
            .select('*')
            .single();

        if (error) {
            logger.error('Failed to link skill', { route: 'POST /api/skills/link', error: String(error) });
            return context.json({ error: 'Failed to link skill' }, 500);
        }
        return context.json(data, 201);
    })

    // Unlink a skill from a task
    .delete('/link/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase.from('skill_links').delete().eq('id', id);
        if (error) {
            logger.error('Failed to unlink skill', { route: 'DELETE /api/skills/link/:id', id, error: String(error) });
            return context.json({ error: 'Failed to unlink skill' }, 500);
        }
        return context.json({ success: true });
    })

    // Get skill detail (full SKILL.md content)
    .get('/:name', async (context) => {
        const name = context.req.param('name');
        const skill = await skill_service.get_skill(name);
        if (!skill) return context.json({ error: 'Skill not found' }, 404);
        return context.json(skill);
    });

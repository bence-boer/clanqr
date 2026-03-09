import { Hono } from 'hono';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { logger } from '../utils/logger';
import { PROJECTS_WORKSPACE_DIR } from '../services/container_service';
import { lookup_mime } from '../services/artifact_service';

export const task_artifact_routes = new Hono<AppBindings>()

    // List file artifacts for a task
    .get('/:id/files', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data, error } = await supabase
            .from('task_artifacts')
            .select('*')
            .eq('task_id', id)
            .order('filename', { ascending: true });

        if (error) {
            logger.error('Failed to fetch artifacts', { route: 'GET /api/tasks/:id/files', id, error: String(error) });
            return context.json({ error: 'Failed to fetch artifacts' }, 500);
        }
        return context.json(data ?? []);
    })

    // Download a specific artifact file
    .get('/:id/files/:filename', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const filename = context.req.param('filename');

        if (!filename || filename.includes('..') || filename.includes('/')) {
            return context.json({ error: 'Invalid filename' }, 400);
        }

        const supabase = context.get('supabase');

        const { data: task } = await supabase
            .from('tasks')
            .select('id, feature_id, features(project_id)')
            .eq('id', id)
            .single();

        if (!task?.features) {
            return context.json({ error: 'Task not found' }, 404);
        }

        const project_id = (task.features as { project_id: string }).project_id;
        const file_path = join(PROJECTS_WORKSPACE_DIR, project_id, `ralph-${id}`, 'artifacts', filename);

        if (!existsSync(file_path)) {
            return context.json({ error: 'File not found' }, 404);
        }

        const mime = lookup_mime(filename);
        const stat = statSync(file_path);
        const file = Bun.file(file_path);

        return new Response(file, {
            headers: {
                'Content-Type': mime,
                'Content-Length': String(stat.size),
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'private, max-age=3600'
            }
        });
    });

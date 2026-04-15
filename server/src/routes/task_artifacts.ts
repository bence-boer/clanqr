import { Hono } from 'hono';
import { existsSync, lstatSync } from 'fs';
import { resolve } from 'path';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { logger } from '../utils/logger';
import { WORKSPACE_DIR } from '../env';
import { lookup_mime } from '../services/artifact_service';

export const task_artifact_routes = new Hono<AppBindings>()

    // List file artifacts for a task
    .get('/:id/files', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
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
        const id = require_param(context, 'id');
        const raw_filename = context.req.param('filename');

        // Decode and validate filename
        let filename: string;
        try {
            filename = decodeURIComponent(raw_filename ?? '');
        }
        catch {
            return context.json({ error: 'Invalid filename' }, 400);
        }

        // Reject path-escape characters after decoding
        if (!filename || filename.includes('..') || filename.includes('/')
          || filename.includes('\\') || filename.includes('\0')) {
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
        const base_dir = resolve(WORKSPACE_DIR, project_id, `ralph-${id}`, 'artifacts');
        const file_path = resolve(base_dir, filename);

        // Verify resolved path is within the expected directory
        if (!file_path.startsWith(base_dir + '/')) {
            return context.json({ error: 'Invalid filename' }, 400);
        }

        if (!existsSync(file_path)) {
            return context.json({ error: 'File not found' }, 404);
        }

        // Check for symlinks — don't follow them
        const stat = lstatSync(file_path);
        if (stat.isSymbolicLink() || !stat.isFile()) {
            return context.json({ error: 'Invalid file' }, 400);
        }

        const mime = lookup_mime(filename);
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

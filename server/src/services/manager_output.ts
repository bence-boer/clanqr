import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TypedSupabaseClient } from '../db';
import { logger } from '../utils/logger';

const task_output_schema = z.object({
    title: z.string().min(5, 'Task title must be at least 5 characters').max(80, 'Task title must not exceed 80 characters'),
    description: z.string().min(20, 'Task description must be at least 20 characters').max(5000, 'Task description must not exceed 5000 characters')
}).strict();

// Also accept legacy format (description only) for backwards compatibility
const legacy_task_schema = z.object({
    description: z.string().min(20, 'Task description must be at least 20 characters').max(5000, 'Task description must not exceed 5000 characters')
}).strict();

const manager_output_schema = z.array(z.union([task_output_schema, legacy_task_schema]))
    .min(1, 'At least one task is required')
    .max(50, 'Maximum 50 tasks allowed');

const MAX_OUTPUT_FILE_SIZE = 1024 * 1024; // 1MB

export async function parse_manager_output(
    feature_id: string,
    work_dir: string,
    supabase: TypedSupabaseClient,
    run_id?: string
) {
    const tasks_file = join(work_dir, 'tasks.json');

    if (!existsSync(tasks_file)) {
        logger.error('Manager exited 0 but no tasks.json', { service: 'agent', feature_id });
        await supabase.from('features')
            .update({ status: 'Draft' })
            .eq('id', feature_id);
        if (run_id) {
            await supabase.from('agent_runs')
                .update({ status: 'failed', error: 'Manager completed but produced no tasks.json' })
                .eq('id', run_id);
        }
        return;
    }

    try {
        const { size } = Bun.file(tasks_file);
        if (size > MAX_OUTPUT_FILE_SIZE) {
            const error_msg = `tasks.json exceeds maximum size (${size} bytes > ${MAX_OUTPUT_FILE_SIZE})`;
            logger.error('tasks.json exceeds size limit', { service: 'agent', feature_id, size, max: MAX_OUTPUT_FILE_SIZE });
            await supabase.from('features')
                .update({ status: 'Draft' })
                .eq('id', feature_id);
            if (run_id) {
                await supabase.from('agent_runs')
                    .update({ status: 'failed', error: error_msg })
                    .eq('id', run_id);
            }
            return;
        }

        const content = readFileSync(tasks_file, 'utf-8');
        const raw = JSON.parse(content);
        const result = manager_output_schema.safeParse(raw);

        if (!result.success) {
            const error_msg = `Invalid tasks.json: ${result.error.issues.map((i) => i.message).join('; ')}`;
            logger.error('Invalid tasks.json schema', { service: 'agent', feature_id, error: error_msg });
            await supabase.from('features')
                .update({ status: 'Draft' })
                .eq('id', feature_id);
            if (run_id) {
                await supabase.from('agent_runs')
                    .update({ status: 'failed', error: error_msg })
                    .eq('id', run_id);
            }
            return;
        }

        const task_rows = result.data.map((t, index) => ({
            feature_id,
            title: 'title' in t ? t.title : null,
            description: t.description,
            status: 'Pending_Approval' as const,
            sort_order: index
        }));

        const { error: insert_error } = await supabase.from('tasks').insert(task_rows);
        if (insert_error) {
            logger.error('Failed to insert tasks', { service: 'agent', feature_id, error: insert_error.message });
            await supabase.from('features').update({ status: 'Draft' }).eq('id', feature_id);
            return;
        }
    }
    catch (error) {
        const error_msg = error instanceof Error ? error.message : 'Unknown parse error';
        logger.error('Failed to parse manager tasks output', { service: 'agent', feature_id, error: error_msg });
        await supabase.from('features')
            .update({ status: 'Draft' })
            .eq('id', feature_id);
        if (run_id) {
            await supabase.from('agent_runs')
                .update({ status: 'failed', error: `Failed to parse tasks.json: ${error_msg}` })
                .eq('id', run_id);
        }
    }
}

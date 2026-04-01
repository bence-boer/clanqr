import type { TypedSupabaseClient } from '../db';
import type { Tables } from '../database.types';
import { check_and_complete_feature } from './feature_utils';
import { logger } from '../utils/logger';

export type PipelineTask = Tables<'tasks'> & { features?: Tables<'features'> & { projects?: { id: string, name: string } } };

export async function handle_task_failure(
    task: PipelineTask,
    supabase: TypedSupabaseClient,
    run_id: string,
    reason?: string
): Promise<'retry' | 'skip' | 'stop'> {
    const behavior: string = task.features?.on_task_failure ?? 'stop';
    const retry_count: number = task.retry_count ?? 0;
    const max_retries: number = task.max_retries ?? 1;

    logger.error('Task failed', {
        service: 'pipeline',
        task_id: task.id,
        description: task.description.slice(0, 50),
        behavior,
        reason: reason ?? 'non-zero exit'
    });

    if (behavior === 'retry' && retry_count < max_retries) {
        const { error: retry_error } = await supabase
            .from('tasks')
            .update({ status: 'approved', retry_count: retry_count + 1 })
            .eq('id', task.id);
        if (retry_error) logger.error('Failed to update task for retry', { service: 'pipeline', task_id: task.id, error: retry_error.message });
        logger.info('Retrying task', { service: 'pipeline', task_id: task.id, attempt: retry_count + 1, max_retries });
        return 'retry';
    }
    else if (behavior === 'skip') {
        const { error: skip_error } = await supabase
            .from('tasks')
            .update({ status: 'skipped', output: `Skipped after failure: ${reason ?? 'non-zero exit'}` })
            .eq('id', task.id);
        if (skip_error) logger.error('Failed to update task as skipped', { service: 'pipeline', task_id: task.id, error: skip_error.message });
        logger.info('Skipping failed task', { service: 'pipeline', task_id: task.id });

        const done = await check_and_complete_feature(task.feature_id, supabase);
        if (done) {
            logger.info('Feature complete (some tasks skipped)', { service: 'pipeline', feature: task.features?.title });
        }
        return 'skip';
    }
    else {
        const { error: pause_error } = await supabase.from('tasks').update({ status: 'approved' }).eq('id', task.id);
        if (pause_error) logger.error('Failed to reset task status', { service: 'pipeline', task_id: task.id, error: pause_error.message });
        logger.info('Pipeline paused due to task failure', { service: 'pipeline', task_id: task.id });
        return 'stop';
    }
}

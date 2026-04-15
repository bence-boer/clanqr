import { create_supabase_client } from './db';
import { pipeline_service } from './services/pipeline_service';
import { prompt_service } from './services/prompt_service';
import { watcher_service } from './services/watcher_service';
import { agent_registry_service } from './services/agent_registry_service';
import { logger } from './utils/logger';

export async function boot() {
    const supabase = create_supabase_client();

    // 1. Recover stale agent runs from previous server crash
    const now = new Date().toISOString();

    const { data: interrupted_runs } = await supabase
        .from('agent_sessions')
        .select('feature_id')
        .eq('agent_type', 'orchestrator')
        .eq('status', 'running');
    const interrupted_feature_ids: string[] = (interrupted_runs ?? [])
        .map((r) => r.feature_id)
        .filter((id): id is string => id !== null);

    await supabase
        .from('agent_sessions')
        .update({ status: 'failed', error: 'Server restarted during execution', finished_at: now })
        .eq('status', 'running');
    await supabase
        .from('tasks')
        .update({ status: 'approved' })
        .eq('status', 'in_progress');

    if (interrupted_feature_ids.length > 0) {
        await supabase
            .from('features')
            .update({ status: 'submitted' })
            .eq('status', 'in_progress')
            .in('id', interrupted_feature_ids);
    }

    // M-6.5: Reset in_progress features that have no tasks (missing tasks.json scenario)
    const { data: in_progress_features } = await supabase
        .from('features')
        .select('id, tasks(id)')
        .eq('status', 'in_progress');

    for (const feature of in_progress_features ?? []) {
        if (!feature.tasks?.length) {
            await supabase
                .from('features')
                .update({ status: 'submitted' })
                .eq('id', feature.id);
            logger.info('Reset feature to submitted (no tasks found)', { service: 'boot', feature_id: feature.id });
        }
    }

    logger.info('Stale process recovery complete', { service: 'boot' });

    // 2. Sync base prompts from repo files → DB
    await prompt_service.sync_from_repo();

    // 3. Sync agent type definitions from filesystem → DB
    await agent_registry_service.sync_agent_types();

    // 4. Cleanup expired data
    await cleanup_expired_data(supabase);

    setInterval(() => {
        cleanup_expired_data(supabase).catch((err) => {
            logger.error('Cleanup error', { service: 'boot', error: String(err) });
        });
    }, 24 * 60 * 60 * 1000);

    // 5. Start watcher service (orchestrator-only — pipeline handles task execution)
    watcher_service.start();

    // 6. Start pipeline service — trigger on any already-approved tasks
    pipeline_service.process_next().catch((err) => {
        logger.error('Pipeline start error', { service: 'boot', error: String(err) });
    });
    logger.info('Pipeline service started', { service: 'boot' });
}

/** M-5.5: Clean expired sessions */
async function cleanup_expired_data(supabase: ReturnType<typeof create_supabase_client>) {
    const now = new Date().toISOString();

    const { count: sessions_deleted } = await supabase
        .from('sessions')
        .delete({ count: 'exact' })
        .lt('expires_at', now);

    if ((sessions_deleted ?? 0) > 0) {
        logger.info('Cleaned expired data', {
            service: 'boot',
            sessions_deleted: sessions_deleted ?? 0
        });
    }
}

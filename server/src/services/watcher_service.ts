import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import type { Tables } from '../database.types';
import { agent_service } from './agent_service';
import { pipeline_service } from './pipeline_service';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5000;
const MAX_MANAGER_RETRIES = 3;

class WatcherService {
    private interval: ReturnType<typeof setInterval> | null = null;
    private is_running = false;

    start() {
        if (this.is_running) return;
        this.is_running = true;
        logger.info('Watcher service started', { service: 'watcher', poll_interval_ms: POLL_INTERVAL_MS });

        this.interval = setInterval(() => {
            this.poll().catch((error) => {
                logger.error('Watcher poll error', { service: 'watcher', error: String(error) });
            });
        }, POLL_INTERVAL_MS);

        // Run immediately
        this.poll().catch((err) => logger.error('Watcher initial poll error', { service: 'watcher', error: String(err) }));
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.is_running = false;
        logger.info('Watcher service stopped', { service: 'watcher' });
    }

    private async poll() {
        const supabase = create_supabase_client();
        await this.check_submitted_features(supabase);
    }

    private async check_submitted_features(supabase: TypedSupabaseClient) {
        const { data: features, error } = await supabase
            .from('features')
            .select('*, resources(*), projects(*)')
            .eq('status', 'submitted');

        if (error || !features) return;

        for (const feature of features) {
            // M-6.1: Enforce manager retry cap
            if ((feature.manager_retry_count ?? 0) >= MAX_MANAGER_RETRIES) {
                await supabase.from('features').update({
                    status: 'draft',
                    last_error: `Manager failed after ${MAX_MANAGER_RETRIES} attempts`
                }).eq('id', feature.id);
                continue;
            }

            const process_id = `manager-${feature.id}`;
            const existing = agent_service.get_all_processes()[process_id];

            // Skip if there's already a running or completed manager process in memory
            if (existing && existing.status !== 'failed') continue;

            // Check if there's already a recent running manager in the DB (survives restarts)
            const { data: recent_run } = await supabase
                .from('agent_sessions')
                .select('id, status')
                .eq('agent_type', 'manager')
                .eq('feature_id', feature.id)
                .in('status', ['running', 'completed'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (recent_run) continue;

            logger.info('Spawning manager for feature', { service: 'watcher', feature_id: feature.id, title: feature.title });
            this.spawn_manager_and_maybe_auto_approve(feature, supabase).catch(
                (err) => logger.error('Manager spawn error', { service: 'watcher', feature_id: feature.id, error: String(err) })
            );
        }
    }

    private async spawn_manager_and_maybe_auto_approve(
        feature: Tables<'features'> & { resources?: { url: string, title: string | null }[], projects?: { name: string } },
        supabase: TypedSupabaseClient
    ) {
        await agent_service.spawn_manager(feature, supabase);

        // If auto_approve is enabled, approve all created tasks and kick the pipeline
        if (feature.auto_approve) {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('id')
                .eq('feature_id', feature.id)
                .eq('status', 'queued');

            if (tasks && tasks.length > 0) {
                await supabase
                    .from('tasks')
                    .update({ status: 'approved' })
                    .eq('feature_id', feature.id)
                    .eq('status', 'queued');

                logger.info('Auto-approved tasks', { service: 'watcher', feature_id: feature.id, count: tasks.length, title: feature.title });
                pipeline_service.process_next().catch(
                    (err) => logger.error('Pipeline process_next error after auto-approve', { service: 'watcher', error: String(err) })
                );
            }
        }
    }
}

export const watcher_service = new WatcherService();

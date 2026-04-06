import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import type { Tables } from '../database.types';
import { plan_feature } from './sdk_session_service';
import { prompt_service } from './prompt_service';
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
            if ((feature.manager_retry_count ?? 0) >= MAX_MANAGER_RETRIES) {
                await supabase.from('features').update({
                    status: 'draft',
                    last_error: `Manager failed after ${MAX_MANAGER_RETRIES} attempts`
                }).eq('id', feature.id);
                continue;
            }

            // Check DB for recent running/completed manager
            const { data: recent_run } = await supabase
                .from('agent_sessions')
                .select('id, status')
                .eq('agent_type', 'orchestrator')
                .eq('feature_id', feature.id)
                .in('status', ['running', 'completed'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (recent_run) continue;

            logger.info('Planning feature via SDK', { service: 'watcher', feature_id: feature.id, title: feature.title });
            this.plan_and_maybe_auto_approve(feature, supabase).catch(
                (err) => logger.error('Plan feature error', { service: 'watcher', feature_id: feature.id, error: String(err) })
            );
        }
    }

    private async plan_and_maybe_auto_approve(
        feature: Tables<'features'> & { resources?: { url: string, title: string | null }[], projects?: { name: string } },
        supabase: TypedSupabaseClient
    ) {
        const prompt = await prompt_service.resolve_for_manager(
            {
                title: feature.title,
                description: feature.description,
                project: feature.projects?.name ?? 'Unknown',
                resources: (feature.resources ?? []).map((r) => ({ url: r.url, title: r.title }))
            },
            feature.id, feature.project_id, supabase
        );

        const model = feature.planning_model || 'gpt-4.1';
        await plan_feature(feature.id, model, prompt);

        if (feature.auto_approve) {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('id')
                .eq('feature_id', feature.id)
                .eq('status', 'queued');

            if (tasks && tasks.length > 0) {
                await supabase.from('tasks')
                    .update({ status: 'approved' })
                    .eq('feature_id', feature.id)
                    .eq('status', 'queued');

                logger.info('Auto-approved tasks', { service: 'watcher', feature_id: feature.id, count: tasks.length });
                pipeline_service.process_next().catch(
                    (err) => logger.error('Pipeline error after auto-approve', { service: 'watcher', error: String(err) })
                );
            }
        }
    }
}

export const watcher_service = new WatcherService();

import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import type { Tables } from '../database.types';
import { run_agent_session } from './sdk_session_service';
import { can_start_session } from './session_pool_service';
import { parse_orchestrator_output } from '../sdk/output_parser';
import { validate_dag, insert_dag_from_plan, compute_waves } from './dag_service';
import type { DagTask } from './dag_service';
import { prompt_service } from './prompt_service';
import { pipeline_service } from './pipeline_service';
import { event_bus } from './event_bus';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5000;
const MAX_MANAGER_RETRIES = 3;
const ORCHESTRATOR_TIMEOUT_MS = 5 * 60 * 1000;

type FeatureRow = Tables<'features'> & {
    resources?: { url: string, title: string | null }[]
    projects?: { name: string }
};

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

        this.poll().catch((err) =>
            logger.error('Watcher initial poll error', { service: 'watcher', error: String(err) })
        );
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

            // Check DB for recent running/completed orchestrator session
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

            if (!can_start_session()) {
                logger.warn('Session limit reached, skipping feature', {
                    service: 'watcher', feature_id: feature.id
                });
                continue;
            }

            logger.info('Planning feature via orchestrator', {
                service: 'watcher', feature_id: feature.id, title: feature.title
            });
            this.plan_with_dag(feature, supabase).catch((err) =>
                logger.error('Plan feature error', {
                    service: 'watcher', feature_id: feature.id, error: String(err)
                })
            );
        }
    }

    private async plan_with_dag(feature: FeatureRow, supabase: TypedSupabaseClient) {
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
        const result = await run_agent_session({
            agent_type: 'orchestrator',
            entity_id: feature.id,
            entity_type: 'feature',
            feature_id: feature.id,
            model,
            prompt,
            timeout_ms: ORCHESTRATOR_TIMEOUT_MS
        });

        if (!result.success) {
            await this.mark_feature_draft(
                feature.id, result.error ?? 'Orchestrator session failed', supabase
            );
            return;
        }

        const parsed = parse_orchestrator_output(result.content);
        if ('error' in parsed) {
            await this.mark_feature_draft(feature.id, parsed.error, supabase);
            return;
        }

        const dag_tasks: DagTask[] = parsed.tasks;
        const validation = validate_dag(dag_tasks);
        if (!validation.valid) {
            logger.error('DAG validation failed', {
                service: 'watcher', feature_id: feature.id, errors: validation.errors
            });
            await this.mark_feature_draft(
                feature.id, `DAG validation: ${validation.errors.join('; ')}`, supabase
            );
            return;
        }

        await insert_dag_from_plan(feature.id, dag_tasks, supabase);
        const wave_count = await compute_waves(feature.id, supabase);

        await supabase.from('features').update({ status: 'in_progress' }).eq('id', feature.id);
        event_bus.emit({ type: 'dag:update', data: { feature_id: feature.id, wave_count } });
        event_bus.emit({ type: 'features:update', data: { feature_id: feature.id, status: 'in_progress' } });

        if (feature.auto_approve) {
            await this.auto_approve_and_dispatch(feature.id, supabase);
        }
    }

    private async mark_feature_draft(
        feature_id: string, error_msg: string, supabase: TypedSupabaseClient
    ) {
        await supabase.from('features').update({
            status: 'draft',
            last_error: error_msg
        }).eq('id', feature_id);
        event_bus.emit({ type: 'features:update', data: { feature_id, status: 'draft' } });
    }

    private async auto_approve_and_dispatch(feature_id: string, supabase: TypedSupabaseClient) {
        const { data: tasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('feature_id', feature_id)
            .eq('status', 'queued');

        if (!tasks || tasks.length === 0) return;

        await supabase.from('tasks')
            .update({ status: 'approved' })
            .eq('feature_id', feature_id)
            .eq('status', 'queued');

        logger.info('Auto-approved tasks', { service: 'watcher', feature_id, count: tasks.length });
        pipeline_service.process_ready_tasks().catch((err) =>
            logger.error('Pipeline error after auto-approve', { service: 'watcher', error: String(err) })
        );
    }
}

export const watcher_service = new WatcherService();

import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import { prompt_service } from './prompt_service';
import { check_and_complete_feature } from './feature_utils';
import { execute_task as sdk_execute_task } from './sdk_session_service';
import { logger } from '../utils/logger';
import { can_start_session, set_on_session_freed } from './session_pool_service';
import { event_bus } from './event_bus';
import { handle_task_failure, type PipelineTask } from './pipeline_failure';

type PipelineState = 'idle' | 'running' | 'paused';

interface ActiveRun {
    task_id: string
    run_id: string
    feature_id: string
}

class PipelineService {
    private state: PipelineState = 'idle';
    private active_run: ActiveRun | null = null;
    private is_processing = false;

    private build_status() {
        return {
            state: this.state,
            current_task_id: this.active_run?.task_id ?? null,
            current_run_id: this.active_run?.run_id ?? null,
            current_feature_id: this.active_run?.feature_id ?? null
        };
    }

    private emit_status() {
        event_bus.emit({ type: 'pipeline:status', data: this.build_status() });
    }

    get_status() {
        return this.build_status();
    }

    get_log(): string {
        return '';
    }

    async process_next(): Promise<void> {
        if (this.state === 'paused' || this.is_processing || this.active_run) return;
        this.is_processing = true;

        try {
            const supabase = create_supabase_client();
            const task = await this.get_next_task(supabase);
            if (!task) {
                if ((this.state as PipelineState) !== 'paused') {
                    this.state = 'idle';
                    this.emit_status();
                }
                return;
            }
            this.state = 'running';
            this.emit_status();
            await this.run_task(task, supabase);
        }
        catch (error) {
            logger.error('Pipeline process_next error', { service: 'pipeline', error: String(error) });
            if ((this.state as PipelineState) !== 'paused') {
                this.state = 'idle';
                this.emit_status();
            }
        }
        finally {
            this.is_processing = false;
        }
    }

    pause() {
        if (this.state !== 'paused') {
            this.state = 'paused';
            logger.info('Pipeline paused', { service: 'pipeline' });
            this.emit_status();
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'idle';
            logger.info('Pipeline resumed', { service: 'pipeline' });
            this.emit_status();
            this.process_next().catch((err) => logger.error('Pipeline resume error', { service: 'pipeline', error: String(err) }));
        }
    }

    async stop_current(): Promise<void> {
        if (!this.active_run) return;
        const { task_id, run_id } = this.active_run;
        logger.info('Stopping current pipeline run', { service: 'pipeline', task_id });
        const supabase = create_supabase_client();
        if (run_id) {
            await supabase.from('agent_sessions')
                .update({ status: 'cancelled', finished_at: new Date().toISOString() })
                .eq('id', run_id);
        }

        await supabase.from('tasks').update({ status: 'approved' }).eq('id', task_id);
        this.active_run = null;
        if (this.state !== 'paused') this.state = 'idle';
        this.emit_status();
    }

    private async get_next_task(supabase: TypedSupabaseClient): Promise<PipelineTask | null> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, features(*, projects(*))')
            .eq('status', 'approved')
            .order('created_at', { foreignTable: 'features', ascending: true })
            .order('sort_order', { ascending: true })
            .limit(1)
            .single();
        if (error || !data) return null;
        return data;
    }

    private async run_task(task: PipelineTask, supabase: TypedSupabaseClient): Promise<void> {
        if (!can_start_session()) {
            logger.warn('Session limit reached, deferring task', { service: 'pipeline', task_id: task.id });
            setTimeout(() => this.process_next().catch((err) =>
                logger.error('Deferred pipeline error', { service: 'pipeline', error: String(err) })
            ), 5000);
            return;
        }

        const task_id = task.id;
        const feature_id: string = task.feature_id;
        const task_spec = {
            task_id, title: task.title, description: task.description,
            feature_title: task.features?.title ?? 'Unknown',
            project_name: task.features?.projects?.name ?? 'Unknown'
        };

        const { error: status_error } = await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task_id);
        if (status_error) logger.error('Failed to update task status', { service: 'pipeline', task_id, error: status_error.message });

        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'in_progress' } });

        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);
        const model = task.model || task.features?.execution_model || 'gpt-4.1';

        this.active_run = { task_id, run_id: '', feature_id };

        try {
            // Session count is managed inside sdk_execute_task (single owner)
            const result = await sdk_execute_task(task_id, feature_id, model, prompt);
            this.active_run.run_id = result.session_id;

            if (result.success) {
                await supabase.from('tasks').update({
                    status: 'complete', output: result.content
                }).eq('id', task.id);
                event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'complete' } });
                const done = await check_and_complete_feature(task.feature_id, supabase);
                if (done) {
                    logger.info('Feature complete', { service: 'pipeline', feature: task.features?.title, feature_id });
                    event_bus.emit({ type: 'features:update', data: { feature_id, status: 'done', project_id: task.features?.projects?.id } });
                }
            }
            else {
                const outcome = await handle_task_failure(task, supabase, '', result.error);
                event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
                if (outcome === 'stop') {
                    this.state = 'paused';
                    this.emit_status();
                }
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            const outcome = await handle_task_failure(task, supabase, this.active_run.run_id, msg);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            if (outcome === 'stop') {
                this.state = 'paused';
                this.emit_status();
            }
        }
        finally {
            this.active_run = null;
        }

        setTimeout(() => this.process_next().catch((err) =>
            logger.error('Pipeline chain error', { service: 'pipeline', error: String(err) })
        ), 0);
    }
}

export const pipeline_service = new PipelineService();

set_on_session_freed(() => {
    pipeline_service.process_next().catch((err) =>
        logger.error('Pipeline wakeup error', { service: 'pipeline', error: String(err) })
    );
});

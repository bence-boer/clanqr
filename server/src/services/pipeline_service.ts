import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import { prompt_service } from './prompt_service';
import { check_and_complete_feature } from './feature_utils';
import { spawn_agent, read_progress } from './spawn_agent';
import { logger } from '../utils/logger';
import { can_spawn_agent, increment_agent_count, decrement_agent_count, set_on_agent_freed } from './agent_concurrency';
import { agent_service } from './agent_service';
import { event_bus } from './event_bus';
import { handle_task_failure, type PipelineTask } from './pipeline_failure';
import { container_service } from './container_service';

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

    private is_paused(): boolean {
        return this.state === 'paused';
    }

    async process_next(): Promise<void> {
        if (this.is_paused()) return;
        if (this.is_processing || this.active_run) return;

        this.is_processing = true;

        try {
            const supabase = create_supabase_client();
            const task = await this.get_next_task(supabase);

            if (!task) {
                if (!this.is_paused()) {
                    this.state = 'idle';
                    this.emit_status();
                }
                return;
            }

            this.state = 'running';
            this.emit_status();
            await this.execute_task(task, supabase);
        }
        catch (error) {
            logger.error('Pipeline process_next error', { service: 'pipeline', error: String(error) });
            if (!this.is_paused()) {
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
        agent_service.stop_process(task_id, supabase);

        if (run_id) {
            await supabase.from('agent_sessions')
                .update({ status: 'cancelled', finished_at: new Date().toISOString() })
                .eq('id', run_id);
        }

        await supabase.from('tasks').update({ status: 'approved' }).eq('id', task_id);
        this.active_run = null;
        if (this.state !== 'paused') {
            this.state = 'idle';
        }
        this.emit_status();
    }

    get_log(): string {
        if (!this.active_run) return '';
        return agent_service.get_log(this.active_run.task_id);
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

    private async execute_task(task: PipelineTask, supabase: TypedSupabaseClient): Promise<void> {
        if (!can_spawn_agent()) {
            logger.warn('Agent concurrency limit reached, deferring task', { service: 'pipeline', task_id: task.id });
            setTimeout(() => this.process_next().catch((err) => logger.error('Deferred pipeline error', { service: 'pipeline', error: String(err) })), 5000);
            return;
        }

        const task_id = task.id;
        const feature_id: string = task.feature_id;
        const project_id: string | undefined = task.features?.projects?.id;
        if (!project_id) {
            logger.error('Task has no associated project, skipping', { service: 'pipeline', task_id });
            await supabase.from('tasks').update({ status: 'failed', output: 'No associated project found' }).eq('id', task_id);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            setTimeout(() => this.process_next().catch((err) => logger.error('Pipeline error', { service: 'pipeline', error: String(err) })), 0);
            return;
        }
        const agent_dir = `ralph-${task_id}`;
        const work_dir = container_service.agent_workspace(project_id, agent_dir);
        const container_work_dir = `/workspace/${agent_dir}`;
        const task_spec = {
            task_id, title: task.title, description: task.description,
            feature_title: task.features?.title ?? 'Unknown',
            project_name: task.features?.projects?.name ?? 'Unknown'
        };

        const { error: status_error } = await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task_id);
        if (status_error) logger.error('Failed to update task status', { service: 'pipeline', task_id, error: status_error.message });

        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'in_progress' } });

        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);
        const cli = 'copilot';
        const model = 'gpt-4.1';

        this.active_run = { task_id, run_id: '', feature_id };

        increment_agent_count();
        try {
            const result = await spawn_agent({
                agent_type: 'ralph', work_dir, spec_file: 'task-spec.json',
                spec_data: task_spec, prompt, cli, model,
                timeout_ms: (task.features?.task_timeout_minutes ?? 10) * 60 * 1000, task_id,
                feature_id, project_id, container_work_dir
            }, supabase);

            this.active_run.run_id = result.run_id;

            if (result.exit_code === 0) {
                const progress = read_progress(work_dir);
                const output = progress?.summary ?? null;
                await supabase.from('tasks').update({ status: 'complete', output }).eq('id', task.id);
                event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'complete' } });
                const done = await check_and_complete_feature(task.feature_id, supabase);
                if (done) {
                    logger.info('Feature complete', { service: 'pipeline', feature: task.features?.title, feature_id });
                    event_bus.emit({ type: 'features:update', data: { feature_id, status: 'done', project_id: task.features?.projects?.id } });
                }
            }
            else {
                const outcome = await handle_task_failure(task, supabase, result.run_id, result.exit_code === -1 ? 'Timeout' : undefined);
                if (result.log) await supabase.from('tasks').update({ output: result.log.slice(-5000) }).eq('id', task.id);
                event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
                if (outcome === 'stop') {
                    this.state = 'paused';
                    this.emit_status();
                }
            }
        }
        catch (error) {
            const error_message = error instanceof Error ? error.message : 'Unknown error';
            const outcome = await handle_task_failure(task, supabase, this.active_run.run_id, error_message);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            if (outcome === 'stop') {
                this.state = 'paused';
                this.emit_status();
            }
        }
        finally {
            decrement_agent_count();
            this.active_run = null;
        }

        setTimeout(() => this.process_next().catch((err) => logger.error('Pipeline chain error', { service: 'pipeline', error: String(err) })), 0);
    }
}

export const pipeline_service = new PipelineService();

set_on_agent_freed(() => {
    pipeline_service.process_next().catch((err) =>
        logger.error('Pipeline wakeup error', { service: 'pipeline', error: String(err) })
    );
});

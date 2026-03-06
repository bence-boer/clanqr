import { join } from 'path';
import { create_supabase_client } from '../db';
import type { SupabaseClient } from '../db';
import { WORKSPACE_DIR } from '../env';
import { prompt_service } from './prompt_service';
import { check_and_complete_feature } from './feature_utils';
import { spawn_agent } from './spawn_agent';
import { logger } from '../utils/logger';
import { can_spawn_agent, increment_agent_count, decrement_agent_count, set_on_agent_freed } from './agent_concurrency';
import { agent_service } from './agent_service';
import { handle_task_failure, type PipelineTask } from './pipeline_failure';

const PIPELINE_WORKSPACE_DIR = WORKSPACE_DIR;

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

    get_status() {
        return {
            state: this.state,
            current_task_id: this.active_run?.task_id ?? null,
            current_run_id: this.active_run?.run_id ?? null,
            current_feature_id: this.active_run?.feature_id ?? null
        };
    }

    async process_next(): Promise<void> {
        if (this.state === 'paused') return;
        if (this.is_processing || this.active_run) return;

        this.is_processing = true;

        try {
            const supabase = create_supabase_client();
            const task = await this.get_next_task(supabase);

            if (!task) {
                this.state = 'idle';
                return;
            }

            this.state = 'running';
            await this.execute_task(task, supabase);
        }
        catch (error) {
            logger.error('Pipeline process_next error', { service: 'pipeline', error: String(error) });
            this.state = 'idle';
        }
        finally {
            this.is_processing = false;
        }
    }

    pause() {
        if (this.state === 'running') {
            this.state = 'paused';
            logger.info('Pipeline paused', { service: 'pipeline' });
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'idle';
            logger.info('Pipeline resumed', { service: 'pipeline' });
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
            await supabase.from('agent_runs')
                .update({ status: 'stopped', finished_at: new Date().toISOString() })
                .eq('id', run_id);
        }

        await supabase.from('tasks').update({ status: 'Approved' }).eq('id', task_id);
        this.active_run = null;
        this.state = 'idle';
    }

    get_log(): string {
        if (!this.active_run) return '';
        return agent_service.get_log(this.active_run.task_id);
    }

    private async get_next_task(supabase: SupabaseClient): Promise<PipelineTask | null> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, features(*, projects(*))')
            .eq('status', 'Approved')
            .order('created_at', { foreignTable: 'features', ascending: true })
            .order('sort_order', { ascending: true })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    private async execute_task(task: PipelineTask, supabase: SupabaseClient): Promise<void> {
        if (!can_spawn_agent()) {
            logger.warn('Agent concurrency limit reached, deferring task', { service: 'pipeline', task_id: task.id });
            setTimeout(() => this.process_next().catch((err) => logger.error('Deferred pipeline error', { service: 'pipeline', error: String(err) })), 5000);
            return;
        }

        const task_id = task.id;
        const feature_id: string = task.feature_id;
        const work_dir = join(PIPELINE_WORKSPACE_DIR, `ralph-${task_id}`);
        const task_spec = {
            task_id, description: task.description,
            feature_title: task.features?.title ?? 'Unknown',
            project_name: task.features?.projects?.name ?? 'Unknown'
        };

        const { error: status_error } = await supabase.from('tasks').update({ status: 'In_Progress' }).eq('id', task_id);
        if (status_error) logger.error('Failed to update task status', { service: 'pipeline', task_id, error: status_error.message });

        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);
        const cli = task.features?.cli || 'copilot';
        const model = task.model || task.features?.execution_model || (cli === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1');

        this.active_run = { task_id, run_id: '', feature_id };

        increment_agent_count();
        try {
            const result = await spawn_agent({
                agent_type: 'ralph', work_dir, spec_file: 'task-spec.json',
                spec_data: task_spec, prompt, cli, model,
                timeout_ms: (task.features?.task_timeout_minutes ?? 10) * 60 * 1000, task_id
            }, supabase);

            this.active_run.run_id = result.run_id;

            if (result.exit_code === 0) {
                await supabase.from('tasks').update({ status: 'Complete' }).eq('id', task.id);
                const done = await check_and_complete_feature(task.feature_id, supabase);
                if (done) logger.info('Feature complete', { service: 'pipeline', feature: task.features?.title, feature_id });
            }
            else {
                const outcome = await handle_task_failure(task, supabase, result.run_id, result.exit_code === -1 ? 'Timeout' : undefined);
                if (outcome === 'stop') this.state = 'paused';
            }
        }
        catch (error) {
            const error_message = error instanceof Error ? error.message : 'Unknown error';
            const outcome = await handle_task_failure(task, supabase, this.active_run.run_id, error_message);
            if (outcome === 'stop') this.state = 'paused';
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

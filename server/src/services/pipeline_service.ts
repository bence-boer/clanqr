/** V2 DAG-aware pipeline — parallel task execution with verification gates. */
import { create_supabase_client, type TypedSupabaseClient } from '../db';
import { logger } from '../utils/logger';
import { can_start_session, set_on_session_freed } from './session_pool_service';
import { event_bus } from './event_bus';
import { log_store } from './log_store_service';
import type { PipelineTask } from './pipeline_failure';
import { collect_ready_tasks, run_task_lifecycle, format_log_detail } from './pipeline_dispatch';

type PipelineState = 'idle' | 'running' | 'paused';

interface ActiveRun {
    task_id: string
    feature_id: string
    session_id: string
    started_at: number
}

export interface PipelineStatus {
    state: PipelineState
    active_task_ids: string[]
    active_run_count: number
    current_feature_id: string | null
    wave_info: { current_wave: number, total_waves: number } | null
}

class PipelineService {
    private state: PipelineState = 'idle';
    private active_runs = new Map<string, ActiveRun>();
    private is_processing = false;
    private cached_wave_info: PipelineStatus['wave_info'] = null;

    private build_status(): PipelineStatus {
        const task_ids = [...this.active_runs.keys()];
        const first_run = this.active_runs.values().next().value as ActiveRun | undefined;
        return {
            state: this.state,
            active_task_ids: task_ids,
            active_run_count: this.active_runs.size,
            current_feature_id: first_run?.feature_id ?? null,
            wave_info: this.cached_wave_info
        };
    }

    private emit_status() {
        const s = this.build_status();
        event_bus.emit({
            type: 'pipeline:status',
            data: {
                state: s.state,
                current_task_id: s.active_task_ids[0] ?? null,
                current_run_id: null,
                current_feature_id: s.current_feature_id
            }
        });
    }

    get_status(): PipelineStatus {
        return this.build_status();
    }

    get_log(): string {
        const first = this.active_runs.values().next().value as ActiveRun | undefined;
        const sid = first?.session_id;
        if (!sid) return '';
        return log_store.get(sid).map((entry) => {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const detail = format_log_detail(entry);
            return `[${time}] ${entry.type}${detail ? ` — ${detail}` : ''}`;
        }).join('\n');
    }

    /** Main scheduling loop — dispatches all ready tasks up to concurrency limit. */
    async process_ready_tasks(): Promise<void> {
        if (this.state === 'paused' || this.is_processing) return;
        this.is_processing = true;

        try {
            const supabase = create_supabase_client();
            const ready = await collect_ready_tasks(supabase);
            const new_tasks = ready.filter((t) => !this.active_runs.has(t.id));

            for (const task of new_tasks) {
                if (!can_start_session()) break;
                this.dispatch_task(task);
            }

            if (new_tasks.length > 0 || this.active_runs.size > 0) {
                this.state = 'running';
            }
            else if ((this.state as PipelineState) !== 'paused') {
                this.state = 'idle';
            }

            const first = this.active_runs.values().next().value as ActiveRun | undefined;
            this.cached_wave_info = first
                ? await this.fetch_wave_info(first.feature_id, supabase)
                : null;

            this.emit_status();
        }
        catch (error) {
            logger.error('Pipeline process_ready_tasks error', {
                service: 'pipeline', error: String(error)
            });
            if ((this.state as PipelineState) !== 'paused') {
                this.state = 'idle';
                this.emit_status();
            }
        }
        finally {
            this.is_processing = false;
        }
    }

    /** Backward-compat alias. */
    async process_next(): Promise<void> {
        return this.process_ready_tasks();
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
            this.process_ready_tasks().catch((err) =>
                logger.error('Pipeline resume error', { service: 'pipeline', error: String(err) })
            );
        }
    }

    async stop_current(): Promise<void> {
        if (this.active_runs.size === 0) return;
        const supabase = create_supabase_client();
        for (const [task_id] of this.active_runs) {
            await supabase.from('tasks').update({ status: 'approved' }).eq('id', task_id);
        }
        this.active_runs.clear();
        this.cached_wave_info = null;
        if (this.state !== 'paused') this.state = 'idle';
        this.emit_status();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private async fetch_wave_info(
        feature_id: string, supabase: TypedSupabaseClient
    ): Promise<PipelineStatus['wave_info']> {
        const { data } = await supabase
            .from('tasks').select('wave_number, status').eq('feature_id', feature_id);
        if (!data || data.length === 0) return null;
        const with_waves = data.filter((t) => t.wave_number != null);
        if (with_waves.length === 0) return null;
        // wave_number is 0-indexed (assigned by dag_service topological sort)
        const total_waves = Math.max(...with_waves.map((t) => t.wave_number as number)) + 1;
        const pending = with_waves.filter((t) => t.status !== 'complete' && t.status !== 'skipped');
        const current_wave = pending.length > 0
            ? Math.min(...pending.map((t) => t.wave_number as number))
            : total_waves - 1;
        return { current_wave, total_waves };
    }

    private dispatch_task(task: PipelineTask): void {
        const { id: task_id, feature_id } = task;
        this.active_runs.set(task_id, {
            task_id, feature_id, session_id: '', started_at: Date.now()
        });

        const on_session_id = (sid: string) => {
            const run = this.active_runs.get(task_id);
            if (run) run.session_id = sid;
        };
        const on_pause = () => {
            this.state = 'paused';
            this.emit_status();
        };

        run_task_lifecycle(task, on_session_id, on_pause).finally(() => {
            this.active_runs.delete(task_id);
            setTimeout(() => this.process_ready_tasks().catch((e) =>
                logger.error('Pipeline chain error', { service: 'pipeline', error: String(e) })
            ), 0);
        });
    }
}

export const pipeline_service = new PipelineService();

set_on_session_freed(() => {
    pipeline_service.process_ready_tasks().catch((err) =>
        logger.error('Pipeline wakeup error', { service: 'pipeline', error: String(err) })
    );
});

/** Pipeline dispatch helpers — task lifecycle, collection, and verification. */
import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import { prompt_service } from './prompt_service';
import { check_and_complete_feature } from './feature_utils';
import { run_agent_session } from './sdk_session_service';
import { logger } from '../utils/logger';
import { event_bus } from './event_bus';
import { handle_task_failure, type PipelineTask } from './pipeline_failure';
import { get_ready_tasks } from './dag_service';
import { should_verify, dispatch_verifier, handle_verification_result } from './verification_service';

// ── Utilities ────────────────────────────────────────────────────────────────

export function format_log_detail(entry: { type: string, data: Record<string, unknown> }): string {
    const d = entry.data;
    switch (entry.type) {
        case 'tool_start': return `${d.tool_name ?? 'unknown'}`;
        case 'tool_complete': return `${d.tool_name ?? 'unknown'} (${d.success ? '✓' : '✗'})`;
        case 'agent_intent': return String(d.intent ?? '');
        case 'agent_output': return String(d.content ?? '').slice(0, 120);
        case 'usage': return `${d.model ?? ''} +${d.output ?? 0} tokens`;
        case 'error': return String(d.message ?? d.error ?? '');
        default: return '';
    }
}

// ── Ready-task collection ────────────────────────────────────────────────────

export async function collect_ready_tasks(supabase: TypedSupabaseClient): Promise<PipelineTask[]> {
    const { data: features } = await supabase
        .from('features').select('id').eq('status', 'in_progress');

    if (!features || features.length === 0) {
        // Legacy flat queue: grab approved tasks without DAG
        const { data } = await supabase.from('tasks')
            .select('*, features(*, projects(*))')
            .eq('status', 'approved').order('sort_order').limit(5);
        return (data ?? []) as PipelineTask[];
    }

    const all_ready: PipelineTask[] = [];
    for (const f of features) {
        const dag_ready = await get_ready_tasks(f.id, supabase);
        if (dag_ready.length === 0) continue;
        const ids = dag_ready.map((n) => n.id);
        const { data } = await supabase.from('tasks')
            .select('*, features(*, projects(*))').in('id', ids);
        if (data) all_ready.push(...(data as PipelineTask[]));
    }
    return all_ready;
}

// ── Task lifecycle ───────────────────────────────────────────────────────────

export async function run_task_lifecycle(
    task: PipelineTask,
    on_session_id: (sid: string) => void,
    on_pause: () => void
): Promise<void> {
    const supabase = create_supabase_client();
    const task_id = task.id;
    const feature_id = task.feature_id;

    try {
        await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task_id);
        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'in_progress' } });

        const task_spec = {
            task_id, title: task.title, description: task.description,
            feature_title: task.features?.title ?? 'Unknown',
            project_name: task.features?.projects?.name ?? 'Unknown'
        };
        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);
        const model = task.model || task.features?.execution_model || 'gpt-4.1';
        const timeout_ms = (task.features?.task_timeout_minutes ?? 30) * 60 * 1000;

        const result = await run_agent_session({
            agent_type: task.agent_type ?? 'implementer',
            entity_id: task_id, entity_type: 'task',
            feature_id, task_id, model, prompt, timeout_ms
        });

        on_session_id(result.session_id);

        if (result.success) {
            await on_task_completed(task, result.content, supabase);
        }
        else {
            const outcome = await handle_task_failure(task, supabase, '', result.error);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            if (outcome === 'stop') on_pause();
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const outcome = await handle_task_failure(task, supabase, '', msg);
        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
        if (outcome === 'stop') on_pause();
    }
}

// ── Task completion + verification ───────────────────────────────────────────

async function on_task_completed(
    task: PipelineTask, content: string, supabase: TypedSupabaseClient
): Promise<void> {
    const task_id = task.id;
    const feature_id = task.feature_id;

    const needs_verify = should_verify({
        agent_type: task.agent_type ?? 'implementer',
        definition_of_done: task.definition_of_done ?? null
    });

    await supabase.from('tasks').update({ status: 'complete', output: content }).eq('id', task_id);

    if (needs_verify) {
        const vr = await dispatch_verifier(task_id, feature_id, supabase);
        const outcome = await handle_verification_result(task_id, feature_id, vr, supabase);
        event_bus.emit({ type: 'verification:update', data: {
            task_id, feature_id, verdict: vr.verdict, retry_count: task.retry_count ?? 0
        } });
        if (outcome === 'retry') return; // re-queued — will be picked up next cycle
    }

    event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'complete' } });
    const done = await check_and_complete_feature(feature_id, supabase);
    if (done) {
        logger.info('Feature complete', { service: 'pipeline', feature_id });
        event_bus.emit({ type: 'features:update', data: {
            feature_id, status: 'done', project_id: task.features?.projects?.id
        } });
    }
}

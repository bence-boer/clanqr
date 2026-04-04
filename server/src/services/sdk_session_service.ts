/** Agent session lifecycle for planning and execution (one-shot SDK sessions with timeouts). */
import { parse_manager_output, parse_ralph_output } from '../sdk/output_parser';
import { run_session, build_session_update } from './session_runner_service';
import { can_start_session, increment_session_count, decrement_session_count } from './session_pool_service';
import { create_supabase_client } from '../db';
import { event_bus } from './event_bus';
import { logger } from '../utils/logger';
import type { SdkAgentType, SdkSessionConfig } from '../sdk/types';

const db = create_supabase_client();
const MANAGER_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_TASK_TIMEOUT_MS = 30 * 60 * 1000;

function build_session_id(agent_type: SdkAgentType, entity_id: string): string {
    return `${agent_type}-${entity_id}-${Date.now()}`;
}

export async function plan_feature(feature_id: string, model: string, prompt: string): Promise<void> {
    if (!can_start_session()) {
        logger.warn('Session limit reached, queuing plan', { service: 'sdk_session', feature_id });
        return;
    }

    const sdk_sid = build_session_id('manager', feature_id);
    increment_session_count();

    try {
        const { data: run } = await db.from('agent_sessions').insert({
            agent_type: 'manager' as const,
            status: 'running' as const,
            feature_id,
            model,
            sdk_session_id: sdk_sid,
            started_at: new Date().toISOString()
        }).select('id').single();

        const run_id = run?.id ?? '';

        event_bus.emit({
            type: 'pipeline:status',
            data: { state: 'running', current_task_id: null, current_run_id: run_id, current_feature_id: feature_id }
        });

        const config: SdkSessionConfig = {
            session_id: sdk_sid, agent_type: 'manager', model,
            entity_id: feature_id, entity_type: 'feature'
        };
        const result = await run_session(config, prompt, MANAGER_TIMEOUT_MS, run_id);
        const parsed = parse_manager_output(result.content);

        if ('error' in parsed) {
            await db.from('agent_sessions').update(build_session_update(result, 'failed', parsed.error)).eq('id', run_id);
            await db.from('features').update({ status: 'draft' }).eq('id', feature_id);
            event_bus.emit({ type: 'features:update', data: { feature_id, status: 'draft' } });
            return;
        }

        const { data: feature } = await db.from('features').select('id').eq('id', feature_id).single();
        if (!feature) return;

        for (let i = 0; i < parsed.tasks.length; i++) {
            await db.from('tasks').insert({
                feature_id, title: parsed.tasks[i].title,
                description: parsed.tasks[i].description, status: 'queued' as const, sort_order: i
            });
        }

        await db.from('agent_sessions').update(build_session_update(result, 'completed')).eq('id', run_id);
        await db.from('features').update({ status: 'in_progress' }).eq('id', feature_id);
        event_bus.emit({ type: 'features:update', data: { feature_id, status: 'in_progress' } });
    }
    catch (err) {
        logger.error('plan_feature failed', { service: 'sdk_session', feature_id, error: String(err) });
        await db.from('features').update({ status: 'draft' }).eq('id', feature_id);
    }
    finally {
        decrement_session_count();
    }
}

export async function execute_task(
    task_id: string, feature_id: string, model: string, prompt: string,
    timeout_ms?: number
): Promise<{ session_id: string, success: boolean, content: string, error?: string }> {
    const sdk_sid = build_session_id('ralph', task_id);
    increment_session_count();

    try {
        const { data: run } = await db.from('agent_sessions').insert({
            agent_type: 'ralph' as const, status: 'running' as const, task_id, feature_id,
            model, sdk_session_id: sdk_sid, started_at: new Date().toISOString()
        }).select('id').single();

        const run_id = run?.id ?? '';

        await db.from('tasks').update({ status: 'in_progress' }).eq('id', task_id);
        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'in_progress' } });

        const config: SdkSessionConfig = {
            session_id: sdk_sid, agent_type: 'ralph', model,
            entity_id: task_id, entity_type: 'task'
        };
        const effective_timeout = timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS;
        const result = await run_session(config, prompt, effective_timeout, run_id);
        const parsed = parse_ralph_output(result.content);

        if ('error' in parsed) {
            await db.from('tasks').update({ status: 'failed' }).eq('id', task_id);
            await db.from('agent_sessions').update(build_session_update(result, 'failed', parsed.error)).eq('id', run_id);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            return { session_id: sdk_sid, success: false, content: '', error: parsed.error };
        }

        const task_status = parsed.status === 'completed' ? 'complete' as const : 'failed' as const;
        await db.from('tasks').update({ status: task_status, output: parsed.summary ?? null }).eq('id', task_id);
        const session_status = parsed.status === 'completed' ? 'completed' as const : 'failed' as const;
        await db.from('agent_sessions').update({
            ...build_session_update(result, session_status),
            summary: parsed.summary ?? null
        }).eq('id', run_id);

        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: task_status } });
        return { session_id: sdk_sid, success: parsed.status === 'completed', content: parsed.summary ?? '' };
    }
    catch (err) {
        logger.error('execute_task failed', { service: 'sdk_session', task_id, error: String(err) });
        await db.from('tasks').update({ status: 'failed' }).eq('id', task_id);
        return { session_id: sdk_sid, success: false, content: '', error: String(err) };
    }
    finally {
        decrement_session_count();
    }
}

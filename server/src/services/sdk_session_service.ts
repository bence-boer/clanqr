/** Generic agent session lifecycle — one-shot SDK sessions with timeouts. */
import { parse_manager_output, parse_implementer_output } from '../sdk/output_parser';
import { run_session, build_session_update } from './session_runner_service';
import { can_start_session, increment_session_count, decrement_session_count } from './session_pool_service';
import { create_supabase_client, type TypedSupabaseClient } from '../db';
import { event_bus } from './event_bus';
import { logger } from '../utils/logger';
import { get_models } from './model_service';
import { get_sdk_defaults } from './settings_service';
import type { SdkAgentType, SdkSessionConfig } from '../sdk/types';
import type { TablesInsert, Enums } from '../database.types';

const ORCHESTRATOR_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_TASK_TIMEOUT_MS = 30 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentSessionConfig {
    agent_type: string
    entity_id: string
    entity_type: 'feature' | 'task' | 'chat'
    feature_id?: string
    task_id?: string
    model: string
    prompt: string
    timeout_ms?: number
}

export interface AgentSessionResult {
    session_id: string
    db_session_id: string
    success: boolean
    content: string
    error?: string
    metrics: {
        prompt_tokens: number
        completion_tokens: number
        total_cost: number
        duration_ms: number
        files_changed: string[]
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function build_session_id(agent_type: string, entity_id: string): string {
    return `${agent_type}-${entity_id}-${Date.now()}`;
}

async function get_billing_multiplier(model: string): Promise<number> {
    try {
        const models = await get_models();
        return models.find((m) => m.value === model)?.billing_multiplier ?? 0;
    }
    catch {
        return 0;
    }
}

async function get_cost_rate(): Promise<number> {
    try {
        const defaults = await get_sdk_defaults(create_supabase_client());
        return defaults.cost_per_premium_request;
    }
    catch {
        return 0.04;
    }
}

export async function mark_session_failed(id: string, msg: string, supabase?: TypedSupabaseClient) {
    await (supabase ?? create_supabase_client()).from('agent_sessions')
        .update({ status: 'failed', error: msg }).eq('id', id);
}

export async function run_agent_session(config: AgentSessionConfig): Promise<AgentSessionResult> {
    const sdk_sid = build_session_id(config.agent_type, config.entity_id);
    increment_session_count();
    let run_id = '';

    try {
        const db = create_supabase_client();
        const insert_payload: TablesInsert<'agent_sessions'> = {
            agent_type: config.agent_type as Enums<'agent_type'>,
            status: 'running',
            model: config.model,
            sdk_session_id: sdk_sid,
            started_at: new Date().toISOString(),
            ...(config.feature_id ? { feature_id: config.feature_id } : {}),
            ...(config.task_id ? { task_id: config.task_id } : {})
        };
        const { data: run } = await db.from('agent_sessions')
            .insert(insert_payload).select('id').single();
        run_id = run?.id ?? '';

        const sdk_config: SdkSessionConfig = {
            session_id: sdk_sid,
            agent_type: config.agent_type as SdkAgentType,
            model: config.model,
            entity_id: config.entity_id,
            entity_type: config.entity_type,
            billing_multiplier: await get_billing_multiplier(config.model),
            cost_per_premium_request: await get_cost_rate()
        };
        const timeout = config.timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS;
        const result = await run_session(sdk_config, config.prompt, timeout, run_id);

        await db.from('agent_sessions')
            .update(build_session_update(result, 'completed')).eq('id', run_id);

        return {
            session_id: sdk_sid,
            db_session_id: run_id,
            success: true,
            content: result.content,
            metrics: {
                prompt_tokens: result.prompt_tokens ?? 0,
                completion_tokens: result.completion_tokens ?? 0,
                total_cost: result.total_cost ?? 0,
                duration_ms: result.duration_ms ?? 0,
                files_changed: result.files_changed ?? []
            }
        };
    }
    catch (err) {
        if (run_id) await mark_session_failed(run_id, String(err));
        logger.error('run_agent_session failed', {
            service: 'sdk_session', agent_type: config.agent_type,
            entity_id: config.entity_id, error: String(err)
        });
        return {
            session_id: sdk_sid, db_session_id: run_id,
            success: false, content: '', error: String(err),
            metrics: { prompt_tokens: 0, completion_tokens: 0, total_cost: 0, duration_ms: 0, files_changed: [] }
        };
    }
    finally {
        decrement_session_count();
    }
}

// ── Backward-compat wrappers ─────────────────────────────────────────────────

export async function plan_feature(feature_id: string, model: string, prompt: string): Promise<void> {
    if (!can_start_session()) {
        logger.warn('Session limit reached, queuing plan', { service: 'sdk_session', feature_id });
        return;
    }

    const result = await run_agent_session({
        agent_type: 'orchestrator', entity_id: feature_id, entity_type: 'feature',
        feature_id, model, prompt, timeout_ms: ORCHESTRATOR_TIMEOUT_MS
    });

    const db = create_supabase_client();

    if (!result.success) {
        await db.from('features').update({ status: 'draft' }).eq('id', feature_id);
        event_bus.emit({ type: 'features:update', data: { feature_id, status: 'draft' } });
        return;
    }

    const parsed = parse_manager_output(result.content);
    if ('error' in parsed) {
        await db.from('features').update({ status: 'draft' }).eq('id', feature_id);
        event_bus.emit({ type: 'features:update', data: { feature_id, status: 'draft' } });
        return;
    }

    for (let i = 0; i < parsed.tasks.length; i++) {
        await db.from('tasks').insert({
            feature_id, title: parsed.tasks[i].title,
            description: parsed.tasks[i].description, status: 'queued' as const, sort_order: i
        });
    }

    await db.from('features').update({ status: 'in_progress' }).eq('id', feature_id);
    event_bus.emit({ type: 'features:update', data: { feature_id, status: 'in_progress' } });
}

export async function execute_task(
    task_id: string, feature_id: string, model: string, prompt: string,
    timeout_ms?: number
): Promise<{ session_id: string, success: boolean, content: string, error?: string }> {
    const result = await run_agent_session({
        agent_type: 'implementer', entity_id: task_id, entity_type: 'task',
        feature_id, task_id, model, prompt, timeout_ms: timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS
    });

    if (!result.success) {
        return { session_id: result.session_id, success: false, content: '', error: result.error };
    }

    const parsed = parse_implementer_output(result.content);
    if ('error' in parsed) {
        return { session_id: result.session_id, success: false, content: '', error: parsed.error };
    }

    const success = parsed.status === 'completed';
    return { session_id: result.session_id, success, content: parsed.summary ?? '' };
}

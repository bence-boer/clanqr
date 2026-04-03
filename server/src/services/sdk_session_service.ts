/**
 * Core SDK session service — manages agent session lifecycle for planning, execution, and chat.
 * Replaces agent_service + spawn_agent + chat_service.
 */
import { get_connected_client } from '../sdk/client_factory';
import { get_custom_agents } from '../sdk/custom_agents';
import { build_hooks } from '../sdk/hooks';
import { parse_manager_output, parse_ralph_output } from '../sdk/output_parser';
import { map_event, should_forward, extract_usage } from '../sdk/event_mapper';
import { stream_service } from './stream_service';
import { can_start_session, increment_session_count, decrement_session_count } from './session_pool_service';
import { create_supabase_client } from '../db';
import { event_bus } from './event_bus';
import { logger } from '../utils/logger';
import type { SdkAgentType, SdkSessionConfig, SdkSessionResult } from '../sdk/types';

const db = create_supabase_client();

function build_session_id(agent_type: SdkAgentType, entity_id: string): string {
    return `${agent_type}-${entity_id}-${Date.now()}`;
}

async function run_session(config: SdkSessionConfig, prompt: string): Promise<SdkSessionResult> {
    const client = await get_connected_client();
    const hooks = build_hooks(config, '');
    const session = await client.createSession({
        sessionId: config.session_id,
        model: config.model,
        customAgents: get_custom_agents(),
        agent: config.agent_type,
        hooks,
        onPermissionRequest: async () => ({ kind: 'approved' as const })
    });

    let tokens_input = 0;
    let tokens_output = 0;

    session.on((event: { type: string, data: Record<string, unknown>, timestamp?: string }) => {
        if (should_forward(event.type)) {
            const mapped = map_event(event, config.session_id);
            if (mapped) stream_service.emit(config.session_id, mapped);
        }
        if (event.type === 'assistant.usage') {
            const usage = extract_usage(event.data);
            tokens_input += usage.input;
            tokens_output += usage.output;
        }
    });

    const response = await session.sendAndWait({ prompt });
    const content = response?.data?.content ?? '';
    await session.disconnect();

    return { content, session_id: config.session_id, tokens_input, tokens_output };
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
            sdk_session_id: sdk_sid,
            started_at: new Date().toISOString()
        }).select('id').single();

        const run_id = run?.id ?? '';

        event_bus.emit({ type: 'pipeline:status', data: { state: 'running', current_task_id: null, current_run_id: run_id, current_feature_id: feature_id } });

        const config: SdkSessionConfig = { session_id: sdk_sid, agent_type: 'manager', model, entity_id: feature_id, entity_type: 'feature' };
        const result = await run_session(config, prompt);
        const parsed = parse_manager_output(result.content);

        if ('error' in parsed) {
            await db.from('agent_sessions').update({ status: 'failed', error: parsed.error, finished_at: new Date().toISOString(), tokens_input: result.tokens_input, tokens_output: result.tokens_output }).eq('id', run_id);
            await db.from('features').update({ status: 'draft' }).eq('id', feature_id);
            event_bus.emit({ type: 'features:update', data: { feature_id, status: 'draft' } });
            return;
        }

        const { data: feature } = await db.from('features').select('id').eq('id', feature_id).single();
        if (!feature) return;

        for (let i = 0; i < parsed.tasks.length; i++) {
            await db.from('tasks').insert({
                feature_id,
                title: parsed.tasks[i].title,
                description: parsed.tasks[i].description,
                status: 'queued' as const,
                sort_order: i
            });
        }

        await db.from('agent_sessions').update({ status: 'completed', finished_at: new Date().toISOString(), tokens_input: result.tokens_input, tokens_output: result.tokens_output }).eq('id', run_id);
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
    task_id: string, feature_id: string, model: string, prompt: string
): Promise<{ session_id: string, success: boolean, content: string, error?: string }> {
    const sdk_sid = build_session_id('ralph', task_id);
    increment_session_count();

    try {
        const { data: run } = await db.from('agent_sessions').insert({
            agent_type: 'ralph' as const, status: 'running' as const, task_id, feature_id,
            sdk_session_id: sdk_sid, started_at: new Date().toISOString()
        }).select('id').single();

        const run_id = run?.id ?? '';

        await db.from('tasks').update({ status: 'in_progress' }).eq('id', task_id);
        event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'in_progress' } });

        const config: SdkSessionConfig = { session_id: sdk_sid, agent_type: 'ralph', model, entity_id: task_id, entity_type: 'task' };
        const result = await run_session(config, prompt);
        const parsed = parse_ralph_output(result.content);

        if ('error' in parsed) {
            await db.from('tasks').update({ status: 'failed' }).eq('id', task_id);
            await db.from('agent_sessions').update({ status: 'failed', error: parsed.error, finished_at: new Date().toISOString(), tokens_input: result.tokens_input, tokens_output: result.tokens_output }).eq('id', run_id);
            event_bus.emit({ type: 'tasks:update', data: { task_id, feature_id, status: 'failed' } });
            return { session_id: sdk_sid, success: false, content: '', error: parsed.error };
        }

        const task_status = parsed.status === 'completed' ? 'complete' as const : 'failed' as const;
        await db.from('tasks').update({ status: task_status, output: parsed.summary ?? null }).eq('id', task_id);
        await db.from('agent_sessions').update({
            status: parsed.status === 'completed' ? 'completed' as const : 'failed' as const,
            finished_at: new Date().toISOString(), tokens_input: result.tokens_input, tokens_output: result.tokens_output
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

export async function chat_send(
    chat_session_id: string, model: string, message: string
): Promise<{ content: string }> {
    const sdk_sid = build_session_id('researcher', chat_session_id);
    increment_session_count();

    try {
        const client = await get_connected_client();
        const config: SdkSessionConfig = { session_id: sdk_sid, agent_type: 'researcher', model, entity_id: chat_session_id, entity_type: 'chat' };
        const hooks = build_hooks(config, '');
        const session = await client.createSession({
            sessionId: sdk_sid, model, customAgents: get_custom_agents(), agent: 'researcher',
            hooks,
            onPermissionRequest: async () => ({ kind: 'approved' as const })
        });

        const response = await session.sendAndWait({ prompt: message });
        await session.disconnect();
        return { content: response?.data?.content ?? '' };
    }
    finally {
        decrement_session_count();
    }
}

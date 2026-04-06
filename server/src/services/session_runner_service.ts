/** SDK session runner — creates, instruments, and executes a one-shot Copilot session. */
import type { CopilotSession } from '@github/copilot-sdk';
import { get_connected_client } from '../sdk/client_factory';
import { get_custom_agents } from '../sdk/custom_agents';
import { build_hooks } from '../sdk/hooks';
import {
    map_event, should_forward, should_persist,
    extract_usage, extract_shutdown, type ExtractedUsage
} from '../sdk/event_mapper';
import { get_agent_tool_permissions } from '../sdk/types';
import { is_test_mode } from '../test_mode';
import { get_mock_session_result, MOCK_DELAY_MS } from './mock_responses';
import { stream_service } from './stream_service';
import { log_store } from './log_store_service';
import { persist_event, persist_tool_call, update_tool_result } from './telemetry_persist_service';
import type { SdkSessionConfig, SdkSessionResult } from '../sdk/types';

const DEFAULT_COST_PER_PREMIUM_REQUEST = 0.04;

export interface SessionMetrics {
    prompt_tokens: number
    completion_tokens: number
    cache_read: number
    cache_write: number
    total_cost: number
    duration_ms: number
    files_changed: string[]
}

export function empty_metrics(): SessionMetrics {
    return {
        prompt_tokens: 0, completion_tokens: 0,
        cache_read: 0, cache_write: 0,
        total_cost: 0, duration_ms: 0, files_changed: []
    };
}

function accumulate_usage(
    m: SessionMetrics, u: ExtractedUsage,
    billing_multiplier: number, cost_rate: number
): void {
    m.prompt_tokens += u.input;
    m.completion_tokens += u.output;
    m.cache_read += u.cache_read;
    m.cache_write += u.cache_write;
    if (u.cost > 0) {
        m.total_cost += u.cost;
    }
    else if (billing_multiplier > 0) {
        m.total_cost += billing_multiplier * cost_rate;
    }
}

function attach_event_handlers(
    session: CopilotSession,
    session_id: string,
    db_session_id: string,
    metrics: SessionMetrics,
    billing_multiplier: number,
    cost_rate: number
): void {
    session.on((event: {
        type: string
        data: Record<string, unknown>
        timestamp?: string
        ephemeral?: boolean
    }) => {
        if (should_forward(event.type)) {
            const mapped = map_event(event, session_id);
            if (mapped) {
                stream_service.emit(session_id, mapped);
                log_store.append(session_id, mapped);
            }
        }
        if (should_persist(event.type)) {
            persist_event(db_session_id, event.type, event.data);
        }
        if (event.type === 'tool.execution_start') {
            const d = event.data as Record<string, string>;
            persist_tool_call(
                db_session_id,
                d.toolCallId ?? d.id ?? '',
                d.toolName ?? d.name ?? 'unknown',
                d.arguments ?? d.input ?? {},
                d.mcpServerName
            );
        }
        if (event.type === 'tool.execution_complete') {
            const d = event.data as Record<string, unknown>;
            const success = d.success === true;
            const err = d.error as Record<string, unknown> | undefined;
            const err_msg = err ? (err.message as string ?? JSON.stringify(err)) : undefined;
            const telemetry = d.toolTelemetry as Record<string, unknown> | undefined;
            const result_len = (telemetry?.metrics as Record<string, number>)?.resultLength;
            update_tool_result(
                db_session_id,
                (d.toolCallId ?? d.id ?? '') as string,
                success,
                success ? `Completed (${result_len ?? '?'} chars)` : (err_msg ?? 'Failed'),
                success ? undefined : err_msg,
                typeof d.duration === 'number' ? d.duration : undefined
            );
        }
        if (event.type === 'assistant.usage') {
            accumulate_usage(
                metrics, extract_usage(event.data), billing_multiplier, cost_rate
            );
        }
        if (event.type === 'session.shutdown') {
            const shutdown = extract_shutdown(event.data);
            metrics.files_changed = shutdown.files_modified;
            metrics.duration_ms = shutdown.total_api_duration_ms;
        }
    });
}

export async function run_session(
    config: SdkSessionConfig,
    prompt: string,
    timeout_ms: number,
    db_session_id: string
): Promise<SdkSessionResult> {
    if (is_test_mode()) {
        await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
        return get_mock_session_result(config.agent_type, config.session_id);
    }

    const client = await get_connected_client();
    const permissions = await get_agent_tool_permissions(config.agent_type);
    const hooks = build_hooks(config, '', permissions);
    const session = await client.createSession({
        sessionId: config.session_id,
        model: config.model,
        customAgents: await get_custom_agents(),
        agent: config.agent_type,
        hooks,
        onPermissionRequest: async () => ({ kind: 'approved' as const })
    });

    const metrics = empty_metrics();
    const multiplier = config.billing_multiplier ?? 0;
    const cost_rate = config.cost_per_premium_request ?? DEFAULT_COST_PER_PREMIUM_REQUEST;
    attach_event_handlers(
        session, config.session_id, db_session_id, metrics, multiplier, cost_rate
    );

    const response = await session.sendAndWait({ prompt }, timeout_ms);
    const content = response?.data?.content ?? '';
    await session.disconnect();

    return {
        content,
        session_id: config.session_id,
        prompt_tokens: metrics.prompt_tokens,
        completion_tokens: metrics.completion_tokens,
        cache_read: metrics.cache_read,
        cache_write: metrics.cache_write,
        total_cost: metrics.total_cost,
        duration_ms: metrics.duration_ms,
        files_changed: metrics.files_changed
    };
}

export function build_session_update(
    result: SdkSessionResult,
    status: 'completed' | 'failed',
    error?: string
) {
    return {
        status,
        finished_at: new Date().toISOString(),
        prompt_tokens: result.prompt_tokens ?? 0,
        completion_tokens: result.completion_tokens ?? 0,
        cache_read_tokens: result.cache_read ?? 0,
        cache_write_tokens: result.cache_write ?? 0,
        duration_ms: result.duration_ms ?? 0,
        files_changed: result.files_changed ?? [],
        estimated_cost: result.total_cost ?? 0,
        ...(error ? { error } : {})
    };
}

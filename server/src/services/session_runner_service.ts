/** SDK session runner — creates, instruments, and executes a one-shot Copilot session. */
import type { CopilotSession } from '@github/copilot-sdk';
import { get_connected_client } from '../sdk/client_factory';
import { get_custom_agents } from '../sdk/custom_agents';
import { build_hooks } from '../sdk/hooks';
import {
    map_event, should_forward, should_persist,
    extract_usage, extract_shutdown, type ExtractedUsage
} from '../sdk/event_mapper';
import { stream_service } from './stream_service';
import { log_store } from './log_store_service';
import { persist_event } from './telemetry_persist_service';
import type { SdkSessionConfig, SdkSessionResult } from '../sdk/types';

export interface SessionMetrics {
    tokens_input: number
    tokens_output: number
    cache_read: number
    cache_write: number
    total_cost: number
    duration_ms: number
    files_changed: string[]
}

export function empty_metrics(): SessionMetrics {
    return {
        tokens_input: 0, tokens_output: 0,
        cache_read: 0, cache_write: 0,
        total_cost: 0, duration_ms: 0, files_changed: []
    };
}

function accumulate_usage(m: SessionMetrics, u: ExtractedUsage): void {
    m.tokens_input += u.input;
    m.tokens_output += u.output;
    m.cache_read += u.cache_read;
    m.cache_write += u.cache_write;
    m.total_cost += u.cost;
}

function attach_event_handlers(
    session: CopilotSession,
    session_id: string,
    db_session_id: string,
    metrics: SessionMetrics
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
        if (event.type === 'assistant.usage') {
            accumulate_usage(metrics, extract_usage(event.data));
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

    const metrics = empty_metrics();
    attach_event_handlers(session, config.session_id, db_session_id, metrics);

    const response = await session.sendAndWait({ prompt }, timeout_ms);
    const content = response?.data?.content ?? '';
    await session.disconnect();

    return {
        content,
        session_id: config.session_id,
        tokens_input: metrics.tokens_input,
        tokens_output: metrics.tokens_output,
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
        tokens_input: result.tokens_input ?? 0,
        tokens_output: result.tokens_output ?? 0,
        cache_read_tokens: result.cache_read ?? 0,
        cache_write_tokens: result.cache_write ?? 0,
        duration_ms: result.duration_ms ?? 0,
        files_changed: result.files_changed ?? [],
        ...(error ? { error } : {})
    };
}

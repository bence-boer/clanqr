/**
 * Maps SDK streaming events to frontend SSE event types.
 * Covers the full SDK event surface — categorized by forwarding and persistence policy.
 */
import type { SdkEvent, SdkEventType } from './types';

interface RawSdkEvent {
    type: string
    data: Record<string, unknown>
    id?: string
    timestamp?: string
    ephemeral?: boolean
}

const EVENT_MAP: Record<string, SdkEventType> = {
    'assistant.message_delta': 'agent_output',
    'assistant.message': 'agent_message',
    'assistant.intent': 'agent_intent',
    'assistant.reasoning': 'agent_reasoning',
    'assistant.reasoning_delta': 'agent_reasoning_delta',
    'assistant.turn_start': 'agent_turn_start',
    'assistant.turn_end': 'agent_turn_end',
    'assistant.usage': 'usage',
    'tool.execution_start': 'tool_start',
    'tool.execution_complete': 'tool_complete',
    'tool.execution_progress': 'tool_progress',
    'tool.execution_partial_result': 'tool_partial',
    'subagent.started': 'subagent_started',
    'subagent.completed': 'subagent_completed',
    'subagent.failed': 'subagent_failed',
    'session.error': 'error',
    'session.warning': 'warning',
    'session.idle': 'session_idle',
    'session.start': 'session_start',
    'session.shutdown': 'session_shutdown',
    'session.usage_info': 'usage_info',
    'session.compaction_start': 'compaction_start',
    'session.compaction_complete': 'compaction_complete',
    'session.context_changed': 'context_changed',
    'session.task_complete': 'task_complete',
    'session.title_changed': 'title_changed',
    'skill.invoked': 'skill_invoked',
    'permission.requested': 'permission_requested',
    'permission.completed': 'permission_completed'
};

/** Events persisted to agent_events table for historical queries */
const PERSIST_TYPES = new Set([
    'tool.execution_start',
    'tool.execution_complete',
    'session.error',
    'assistant.usage',
    'assistant.turn_start',
    'assistant.turn_end',
    'assistant.intent',
    'session.shutdown',
    'session.compaction_complete',
    'session.usage_info',
    'session.task_complete',
    'subagent.started',
    'subagent.completed',
    'subagent.failed',
    'skill.invoked'
]);

/** Events that carry ephemeral streaming data (high-frequency) */
const EPHEMERAL_TYPES = new Set([
    'assistant.message_delta',
    'assistant.reasoning_delta',
    'assistant.streaming_delta',
    'tool.execution_partial_result',
    'tool.execution_progress'
]);

const SSE_TOOL_RESULT_LIMIT = 50_000;

export function should_forward(raw_type: string): boolean {
    return raw_type in EVENT_MAP;
}

export function should_persist(raw_type: string): boolean {
    return PERSIST_TYPES.has(raw_type);
}

export function is_ephemeral(raw_type: string): boolean {
    return EPHEMERAL_TYPES.has(raw_type);
}

export function map_event(
    raw: RawSdkEvent,
    session_id: string
): SdkEvent | null {
    const mapped_type = EVENT_MAP[raw.type];
    if (!mapped_type) return null;

    const data: Record<string, unknown> = { ...raw.data };

    if (raw.type === 'tool.execution_complete') {
        truncate_tool_result(data);
    }

    return {
        type: mapped_type,
        session_id,
        data,
        timestamp: raw.timestamp ?? new Date().toISOString(),
        ephemeral: raw.ephemeral
    };
}

function truncate_tool_result(data: Record<string, unknown>): void {
    const result = data.result as Record<string, unknown> | undefined;
    if (!result) return;
    const content = result.content;
    if (typeof content === 'string' && content.length > SSE_TOOL_RESULT_LIMIT) {
        result.content = content.slice(0, SSE_TOOL_RESULT_LIMIT) + '… (truncated for SSE)';
        result.truncated = true;
    }
}

export interface ExtractedUsage {
    input: number
    output: number
    cache_read: number
    cache_write: number
    cost: number
    duration_ms: number
    model: string
}

export function extract_usage(
    data: Record<string, unknown>
): ExtractedUsage {
    return {
        input: as_num(data.inputTokens),
        output: as_num(data.outputTokens),
        cache_read: as_num(data.cacheReadTokens),
        cache_write: as_num(data.cacheWriteTokens),
        cost: as_num(data.cost),
        duration_ms: as_num(data.duration),
        model: typeof data.model === 'string' ? data.model : ''
    };
}

export interface ExtractedShutdown {
    total_premium_requests: number
    total_api_duration_ms: number
    lines_added: number
    lines_removed: number
    files_modified: string[]
    model_metrics: Record<string, unknown>
    shutdown_type: string
}

export function extract_shutdown(
    data: Record<string, unknown>
): ExtractedShutdown {
    const changes = data.codeChanges as Record<string, unknown> | undefined;
    const files = changes?.filesModified;
    return {
        total_premium_requests: as_num(data.totalPremiumRequests),
        total_api_duration_ms: as_num(data.totalApiDurationMs),
        lines_added: as_num(changes?.linesAdded),
        lines_removed: as_num(changes?.linesRemoved),
        files_modified: Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [],
        model_metrics: (data.modelMetrics as Record<string, unknown>) ?? {},
        shutdown_type: typeof data.shutdownType === 'string' ? data.shutdownType : 'unknown'
    };
}

function as_num(v: unknown): number {
    return typeof v === 'number' ? v : 0;
}

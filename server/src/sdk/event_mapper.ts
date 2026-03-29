/**
 * Maps SDK streaming events to frontend SSE event types.
 * Only forwards key events — ephemeral deltas are filtered unless subscribed.
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
    'assistant.turn_start': 'agent_turn_start',
    'assistant.turn_end': 'agent_turn_end',
    'tool.execution_start': 'tool_start',
    'tool.execution_complete': 'tool_complete',
    'subagent.started': 'subagent_started',
    'subagent.completed': 'subagent_completed',
    'assistant.usage': 'usage',
    'session.error': 'error',
    'session.idle': 'session_idle'
};

/** Events that should be persisted to the audit log */
const PERSIST_TYPES = new Set([
    'tool.execution_start',
    'tool.execution_complete',
    'session.error',
    'assistant.usage',
    'assistant.turn_end'
]);

/** Events forwarded to SSE subscribers */
const FORWARD_TYPES = new Set(Object.keys(EVENT_MAP));

export function should_forward(raw_type: string): boolean {
    return FORWARD_TYPES.has(raw_type);
}

export function should_persist(raw_type: string): boolean {
    return PERSIST_TYPES.has(raw_type);
}

export function map_event(raw: RawSdkEvent, session_id: string): SdkEvent | null {
    const mapped_type = EVENT_MAP[raw.type];
    if (!mapped_type) return null;

    const data: Record<string, unknown> = { ...raw.data };

    // Truncate large tool results to prevent overwhelming SSE
    if (raw.type === 'tool.execution_complete' && typeof data.toolResult === 'string') {
        const result = data.toolResult as string;
        if (result.length > 2000) {
            data.toolResult = result.slice(0, 2000) + '... (truncated)';
        }
    }

    return {
        type: mapped_type,
        session_id,
        data,
        timestamp: raw.timestamp ?? new Date().toISOString()
    };
}

/** Extract token usage from a usage event */
export function extract_usage(data: Record<string, unknown>): { input: number, output: number } {
    return {
        input: typeof data.inputTokens === 'number' ? data.inputTokens : 0,
        output: typeof data.outputTokens === 'number' ? data.outputTokens : 0
    };
}

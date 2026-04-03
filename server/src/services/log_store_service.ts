/**
 * In-memory log buffer for agent sessions.
 * Stores recent SDK events per session for retrieval via API.
 * Events are kept in a ring buffer (max entries per session) and evicted on session cleanup.
 */
import type { SdkEvent } from '../sdk/types';

const MAX_ENTRIES_PER_SESSION = 500;
const MAX_SESSIONS = 100;

interface LogEntry {
    timestamp: string
    type: string
    summary: string
}

function summarize_event(event: SdkEvent): string {
    const d = event.data;
    switch (event.type) {
        case 'tool_start':
            return `Tool: ${d.toolName ?? 'unknown'}`;
        case 'tool_complete': {
            const result = typeof d.toolResult === 'string' ? d.toolResult : JSON.stringify(d.toolResult ?? '');
            const truncated = result.length > 200 ? result.slice(0, 200) + '…' : result;
            return `Tool done: ${d.toolName ?? 'unknown'} → ${truncated}`;
        }
        case 'agent_message':
            return typeof d.content === 'string'
                ? (d.content.length > 300 ? d.content.slice(0, 300) + '…' : d.content)
                : 'Agent response';
        case 'agent_output':
            return typeof d.content === 'string' ? d.content : '';
        case 'agent_turn_start':
            return 'Turn started';
        case 'agent_turn_end':
            return 'Turn ended';
        case 'usage':
            return `Tokens: ${d.inputTokens ?? 0} in / ${d.outputTokens ?? 0} out`;
        case 'error':
            return `Error: ${d.errorMessage ?? d.message ?? 'unknown'}`;
        case 'subagent_started':
            return `Sub-agent started: ${d.agentName ?? 'unknown'}`;
        case 'subagent_completed':
            return `Sub-agent completed: ${d.agentName ?? 'unknown'}`;
        default:
            return event.type;
    }
}

class LogStore {
    private buffers = new Map<string, LogEntry[]>();
    private session_order: string[] = [];

    append(session_id: string, event: SdkEvent): void {
        let buf = this.buffers.get(session_id);
        if (!buf) {
            buf = [];
            this.buffers.set(session_id, buf);
            this.session_order.push(session_id);
            this.evict_oldest_if_needed();
        }

        const entry: LogEntry = {
            timestamp: event.timestamp,
            type: event.type,
            summary: summarize_event(event)
        };

        buf.push(entry);
        if (buf.length > MAX_ENTRIES_PER_SESSION) {
            buf.splice(0, buf.length - MAX_ENTRIES_PER_SESSION);
        }
    }

    get(session_id: string): LogEntry[] {
        return this.buffers.get(session_id) ?? [];
    }

    clear(session_id: string): void {
        this.buffers.delete(session_id);
        this.session_order = this.session_order.filter((id) => id !== session_id);
    }

    private evict_oldest_if_needed(): void {
        while (this.session_order.length > MAX_SESSIONS) {
            const oldest = this.session_order.shift();
            if (oldest) this.buffers.delete(oldest);
        }
    }
}

export const log_store = new LogStore();

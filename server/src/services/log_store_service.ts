/**
 * In-memory structured event buffer for agent sessions.
 * Stores full SDK events per session for real-time streaming and API retrieval.
 * Events are kept in a ring buffer and evicted on capacity.
 */
import type { SdkEvent } from '../sdk/types';

const MAX_ENTRIES_PER_SESSION = 2000;
const MAX_SESSIONS = 500;

export interface StructuredLogEntry {
    timestamp: string
    type: string
    data: Record<string, unknown>
    ephemeral?: boolean
}

class LogStore {
    private buffers = new Map<string, StructuredLogEntry[]>();
    private session_order: string[] = [];

    append(session_id: string, event: SdkEvent): void {
        let buf = this.buffers.get(session_id);
        if (!buf) {
            buf = [];
            this.buffers.set(session_id, buf);
            this.session_order.push(session_id);
            this.evict_oldest_if_needed();
        }

        buf.push({
            timestamp: event.timestamp,
            type: event.type,
            data: event.data,
            ephemeral: event.ephemeral
        });

        if (buf.length > MAX_ENTRIES_PER_SESSION) {
            buf.splice(0, buf.length - MAX_ENTRIES_PER_SESSION);
        }
    }

    get(session_id: string): StructuredLogEntry[] {
        return this.buffers.get(session_id) ?? [];
    }

    /** Get entries since a specific index (for polling without re-fetching) */
    get_since(session_id: string, after_index: number): StructuredLogEntry[] {
        const buf = this.buffers.get(session_id);
        if (!buf) return [];
        return buf.slice(after_index);
    }

    /** Get latest entry of a given type */
    get_latest(session_id: string, type: string): StructuredLogEntry | null {
        const buf = this.buffers.get(session_id);
        if (!buf) return null;
        for (let i = buf.length - 1; i >= 0; i--) {
            if (buf[i].type === type) return buf[i];
        }
        return null;
    }

    count(session_id: string): number {
        return this.buffers.get(session_id)?.length ?? 0;
    }

    clear(session_id: string): void {
        this.buffers.delete(session_id);
        this.session_order = this.session_order.filter((id) => id !== session_id);
    }

    has(session_id: string): boolean {
        return this.buffers.has(session_id);
    }

    private evict_oldest_if_needed(): void {
        while (this.session_order.length > MAX_SESSIONS) {
            const oldest = this.session_order.shift();
            if (oldest) this.buffers.delete(oldest);
        }
    }
}

export const log_store = new LogStore();

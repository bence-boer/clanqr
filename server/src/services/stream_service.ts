/**
 * Per-session SSE event streaming service.
 * Manages subscriptions for real-time SDK session events.
 */
import type { SdkEvent } from '../sdk/types';

type SessionEventCallback = (event: SdkEvent) => void;

class StreamService {
    private listeners = new Map<string, Set<SessionEventCallback>>();

    /** Subscribe to events for a specific SDK session */
    subscribe(session_id: string, callback: SessionEventCallback): () => void {
        if (!this.listeners.has(session_id)) {
            this.listeners.set(session_id, new Set());
        }
        const subs = this.listeners.get(session_id) ?? new Set<SessionEventCallback>();
        subs.add(callback);

        return () => {
            subs.delete(callback);
            if (subs.size === 0) this.listeners.delete(session_id);
        };
    }

    /** Emit an event to all subscribers of a session */
    emit(session_id: string, event: SdkEvent): void {
        const subs = this.listeners.get(session_id);
        if (!subs) return;
        for (const cb of subs) {
            try {
                cb(event);
            }
            catch {
                /* listener error — swallow */
            }
        }
    }

    /** Check if any clients are subscribed to a session */
    has_subscribers(session_id: string): boolean {
        return (this.listeners.get(session_id)?.size ?? 0) > 0;
    }

    /** Count total subscriptions across all sessions */
    get total_subscribers(): number {
        let count = 0;
        for (const subs of this.listeners.values()) {
            count += subs.size;
        }
        return count;
    }
}

export const stream_service = new StreamService();

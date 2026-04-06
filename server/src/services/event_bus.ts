/**
 * Server-side event bus for real-time SSE streaming.
 *
 * Services emit typed events when state changes. The SSE endpoint subscribes
 * to the bus and streams events to connected clients.
 */
import { logger } from '../utils/logger';

// ── Event types ──────────────────────────────────────────────────────────────

export interface PipelineStatusEvent {
    type: 'pipeline:status'
    data: {
        state: string
        current_task_id: string | null
        current_run_id: string | null
        current_feature_id: string | null
        queue_depth?: number
    }
}

export interface AgentsUpdateEvent {
    type: 'agents:update'
    data: {
        process_id: string
        status: string
        agent_type: string
        started_at: string | null
        finished_at?: string | null
    }
}

export interface FeaturesUpdateEvent {
    type: 'features:update'
    data: {
        feature_id: string
        status: string
        project_id?: string
    }
}

export interface TasksUpdateEvent {
    type: 'tasks:update'
    data: {
        task_id: string
        feature_id: string
        status: string
    }
}

export interface PingEvent {
    type: 'ping'
    data: { timestamp: string }
}

export interface DagUpdateEvent {
    type: 'dag:update'
    data: { feature_id: string, wave_count: number }
}

export interface VerificationUpdateEvent {
    type: 'verification:update'
    data: { task_id: string, feature_id: string, verdict: string, retry_count: number }
}

export type ServerEvent =
  | PipelineStatusEvent
  | AgentsUpdateEvent
  | FeaturesUpdateEvent
  | TasksUpdateEvent
  | PingEvent
  | DagUpdateEvent
  | VerificationUpdateEvent;

// ── EventBus implementation ──────────────────────────────────────────────────

type EventCallback = (event: ServerEvent) => void;

class EventBus {
    private listeners = new Set<EventCallback>();

    subscribe(callback: EventCallback): () => void {
        this.listeners.add(callback);
        logger.debug('SSE client subscribed', { service: 'event_bus', total: this.listeners.size });
        return () => {
            this.listeners.delete(callback);
            logger.debug('SSE client unsubscribed', { service: 'event_bus', total: this.listeners.size });
        };
    }

    emit(event: ServerEvent) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                logger.error('EventBus listener error', { service: 'event_bus', error: String(error) });
            }
        }
    }

    get client_count(): number {
        return this.listeners.size;
    }
}

export const event_bus = new EventBus();

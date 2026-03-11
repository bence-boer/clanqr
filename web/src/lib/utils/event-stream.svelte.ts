import { onMount } from 'svelte';
import { API_URL } from '$lib/api/rpc';

/**
 * Typed server-sent event types matching server/src/services/event_bus.ts.
 */
export interface PipelineStatusData {
    state: string
    current_task_id: string | null
    current_run_id: string | null
    current_feature_id: string | null
    queue_depth?: number
}

export interface AgentsUpdateData {
    process_id: string
    status: string
    agent_type: string
    started_at: string | null
    finished_at?: string | null
}

export interface FeaturesUpdateData {
    feature_id: string
    status: string
    project_id?: string
}

export interface TasksUpdateData {
    task_id: string
    feature_id: string
    status: string
}

export interface SnapshotData {
    pipeline: PipelineStatusData
    agents: Record<string, { status: string, type: string, started_at: string | null, finished_at?: string | null }>
}

type EventHandlers = Record<string, ((data: never) => void) | undefined> & {
    pipeline_status?: (data: PipelineStatusData) => void
    agents_update?: (data: AgentsUpdateData) => void
    features_update?: (data: FeaturesUpdateData) => void
    tasks_update?: (data: TasksUpdateData) => void
    snapshot?: (data: SnapshotData) => void
};

/** Map handler keys (snake_case) to SSE event names (colon-separated) */
const HANDLER_TO_EVENT: Record<string, string> = {
    pipeline_status: 'pipeline:status',
    agents_update: 'agents:update',
    features_update: 'features:update',
    tasks_update: 'tasks:update',
    snapshot: 'snapshot'
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

/**
 * Creates an SSE connection to the server event stream.
 * Auto-reconnects with exponential backoff on disconnect.
 * Falls back to polling if SSE fails repeatedly.
 *
 * Must be called during component initialization (top-level script).
 *
 * @param handlers — callbacks for each event type
 * @param fallback_poll — optional polling callback when SSE is unavailable
 * @param fallback_interval_ms — polling interval when in fallback mode (default 15s)
 */
export function use_event_stream(
    handlers: EventHandlers,
    fallback_poll?: () => Promise<void> | void,
    fallback_interval_ms = 15_000
) {
    let connected = $state(false);
    let is_stale = $state(false);
    let last_event_at = $state(Date.now());
    const stale_threshold_ms = 30_000;

    onMount(() => {
        let event_source: EventSource | null = null;
        let reconnect_delay = INITIAL_RECONNECT_DELAY_MS;
        let reconnect_timer: ReturnType<typeof setTimeout> | null = null;
        let fallback_timer: ReturnType<typeof setInterval> | null = null;
        let stale_check_timer: ReturnType<typeof setInterval> | null = null;
        let destroyed = false;
        let consecutive_failures = 0;
        let was_disconnected = false;
        const MAX_FAILURES_BEFORE_FALLBACK = 3;

        function mark_event_received() {
            last_event_at = Date.now();
            is_stale = false;
        }

        function start_stale_checker() {
            if (stale_check_timer) clearInterval(stale_check_timer);
            stale_check_timer = setInterval(() => {
                is_stale = Date.now() - last_event_at > stale_threshold_ms;
            }, 5_000);
        }

        function start_fallback_polling() {
            if (fallback_timer || !fallback_poll) return;
            fallback_poll();
            fallback_timer = setInterval(fallback_poll, fallback_interval_ms);
        }

        function stop_fallback_polling() {
            if (fallback_timer) {
                clearInterval(fallback_timer);
                fallback_timer = null;
            }
        }

        /** Reverse map: SSE event name → handler key */
        const event_to_handler: Record<string, string> = {};
        for (const [key, sse_name] of Object.entries(HANDLER_TO_EVENT)) {
            event_to_handler[sse_name] = key;
        }

        function parse_and_dispatch(sse_event: string, data_str: string) {
            try {
                const data = JSON.parse(data_str);
                const handler_key = event_to_handler[sse_event] ?? sse_event;
                const handler = handlers[handler_key];
                if (handler) {
                    (handler as (data: unknown) => void)(data);
                }
            }
            catch {
                // Ignore malformed events
            }
        }

        function connect() {
            if (destroyed) return;

            const url = `${API_URL}/api/events/stream`;
            event_source = new EventSource(url, { withCredentials: true });

            event_source.onopen = () => {
                connected = true;
                reconnect_delay = INITIAL_RECONNECT_DELAY_MS;
                const reconnecting = consecutive_failures > 0 || was_disconnected;
                consecutive_failures = 0;
                mark_event_received();
                stop_fallback_polling();
                // Reconcile stale data on reconnect
                if (reconnecting && fallback_poll) {
                    fallback_poll();
                }
                was_disconnected = false;
            };

            event_source.onerror = () => {
                connected = false;
                was_disconnected = true;
                event_source?.close();
                event_source = null;
                consecutive_failures++;

                if (consecutive_failures >= MAX_FAILURES_BEFORE_FALLBACK) {
                    start_fallback_polling();
                }

                if (!destroyed) {
                    reconnect_timer = setTimeout(() => {
                        reconnect_delay = Math.min(reconnect_delay * 2, MAX_RECONNECT_DELAY_MS);
                        connect();
                    }, reconnect_delay);
                }
            };

            // Register listeners for SSE event types that the caller has handlers for
            for (const [handler_key] of Object.entries(handlers)) {
                const sse_event = HANDLER_TO_EVENT[handler_key] ?? handler_key;
                event_source.addEventListener(sse_event, (event: MessageEvent) => {
                    mark_event_received();
                    parse_and_dispatch(sse_event, event.data);
                });
            }

            // Snapshot after reconnect triggers full reconciliation
            event_source.addEventListener('snapshot', (event: MessageEvent) => {
                mark_event_received();
                parse_and_dispatch('snapshot', event.data);
                if (was_disconnected && fallback_poll) {
                    fallback_poll();
                }
            });

            // Ping just keeps the connection fresh
            event_source.addEventListener('ping', () => {
                mark_event_received();
            });
        }

        connect();
        start_stale_checker();

        return () => {
            destroyed = true;
            event_source?.close();
            if (reconnect_timer) clearTimeout(reconnect_timer);
            if (stale_check_timer) clearInterval(stale_check_timer);
            stop_fallback_polling();
        };
    });

    return {
        get connected() {
            return connected;
        },
        get is_stale() {
            return is_stale;
        }
    };
}

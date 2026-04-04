import { API_URL } from './rpc';

export interface TelemetryEvent {
    id: string
    session_id: string
    event_type: string
    event_data: Record<string, unknown>
    created_at: string
}

export interface TelemetryToolCall {
    id: string
    session_id: string
    tool_call_id: string | null
    tool_name: string
    arguments: Record<string, unknown> | null
    result_success: boolean | null
    result_summary: string | null
    error_message: string | null
    duration_ms: number | null
    created_at: string
}

export interface TelemetrySessionSummary {
    session: Record<string, unknown>
    event_count: number
    tool_count: number
}

export interface StructuredLogEntry {
    index: number
    type: string
    timestamp: string
    data: Record<string, unknown>
}

async function fetch_json<ResponseType>(url: string): Promise<ResponseType> {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Telemetry API error: ${res.status}`);
    return res.json();
}

export const telemetry_api = {
    session_events: async (
        session_id: string, limit = 100, offset = 0
    ): Promise<{ events: TelemetryEvent[], total: number }> =>
        fetch_json(`${API_URL}/api/telemetry/sessions/${e(session_id)}/events?limit=${limit}&offset=${offset}`),

    session_tools: async (session_id: string): Promise<{ tools: TelemetryToolCall[] }> =>
        fetch_json(`${API_URL}/api/telemetry/sessions/${e(session_id)}/tools`),

    session_summary: async (session_id: string): Promise<TelemetrySessionSummary> =>
        fetch_json(`${API_URL}/api/telemetry/sessions/${e(session_id)}/summary`),

    session_logs: async (
        sdk_session_id: string, after?: number
    ): Promise<{ entries: StructuredLogEntry[] }> => {
        const qs = after != null ? `?after=${after}` : '';
        return fetch_json(`${API_URL}/api/telemetry/sessions/${e(sdk_session_id)}/logs${qs}`);
    },

    create_session_stream: (sdk_session_id: string): EventSource =>
        new EventSource(
            `${API_URL}/api/telemetry/sessions/${e(sdk_session_id)}/stream`,
            { withCredentials: true }
        )
};

function e(s: string): string {
    return encodeURIComponent(s);
}

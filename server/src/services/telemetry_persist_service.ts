/**
 * Persists SDK events to the database for historical telemetry queries.
 * Handles agent_events and agent_tool_calls tables.
 */
import { create_supabase_client } from '../db';
import { logger } from '../utils/logger';
import type { Json } from '../database.types';

const db = create_supabase_client();

export function persist_event(
    agent_session_id: string,
    event_type: string,
    event_data: Record<string, unknown>
): void {
    db.from('agent_events')
        .insert({
            agent_session_id,
            event_type,
            event_data: event_data as Json
        })
        .then(({ error }) => {
            if (error) {
                logger.warn('Event persist failed', {
                    service: 'telemetry',
                    error: error.message,
                    event_type
                });
            }
        });
}

export function persist_tool_call(
    agent_session_id: string,
    tool_call_id: string,
    tool_name: string,
    args: unknown,
    mcp_server?: string
): void {
    db.from('agent_tool_calls')
        .insert({
            agent_session_id,
            tool_call_id,
            tool_name,
            arguments: (args ?? {}) as Json,
            mcp_server_name: mcp_server ?? null,
            created_at: new Date().toISOString()
        })
        .then(({ error }) => {
            if (error) {
                logger.warn('Tool call persist failed', {
                    service: 'telemetry',
                    error: error.message,
                    tool_name
                });
            }
        });
}

export function update_tool_result(
    agent_session_id: string,
    tool_call_id: string,
    success: boolean,
    result_summary: string,
    error_message?: string,
    duration_ms?: number
): void {
    db.from('agent_tool_calls')
        .update({
            result_success: success,
            result_summary: result_summary.slice(0, 10_000),
            error_message: error_message ?? null,
            duration_ms: duration_ms ?? null
        })
        .eq('agent_session_id', agent_session_id)
        .eq('tool_call_id', tool_call_id)
        .then(({ error }) => {
            if (error) {
                logger.warn('Tool result update failed', {
                    service: 'telemetry',
                    error: error.message,
                    tool_call_id
                });
            }
        });
}

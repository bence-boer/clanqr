/**
 * Audit logging service for SDK hook events.
 * Logs tool calls, permission decisions, errors, and session lifecycle events.
 */
import { create_supabase_client } from '../db';
import { logger } from '../utils/logger';

import type { Json } from '../database.types';

type AuditEventType =
  | 'tool_call' | 'tool_result' | 'permission_denied' | 'error' | 'session_start' | 'session_end'
  | 'admin_role_change' | 'admin_session_revoke' | 'admin_user_delete';

export class AuditService {
    private db = create_supabase_client();

    log_event(session_id: string, agent_type: string | null, event_type: AuditEventType, payload: Record<string, Json>): void {
        this.db.from('audit_events')
            .insert({
                session_id,
                event_type,
                agent_type,
                payload
            })
            .then(({ error }) => {
                if (error) logger.warn('Audit insert failed', { service: 'audit', error: error.message });
            });
    }

    log_tool_call(session_id: string, agent_type: string | null, tool_name: string, tool_args: unknown): void {
        const args_str = JSON.stringify(tool_args ?? {}).slice(0, 2000);
        this.log_event(session_id, agent_type, 'tool_call', { tool_name, tool_args: args_str });
    }

    log_tool_result(session_id: string, agent_type: string | null, tool_name: string, summary: string): void {
        this.log_event(session_id, agent_type, 'tool_result', { tool_name, summary: summary.slice(0, 2000) });
    }

    log_admin_action(actor_id: string, event_type: AuditEventType, payload: Record<string, Json>): void {
        this.db.from('audit_events')
            .insert({
                session_id: `admin:${actor_id}`,
                event_type,
                agent_type: null,
                payload
            })
            .then(({ error }) => {
                if (error) logger.warn('Audit insert failed', { service: 'audit', error: error.message });
            });
    }
}

export const audit_service = new AuditService();

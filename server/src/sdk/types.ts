/**
 * Type definitions for the Copilot SDK integration layer.
 */

export type SdkAgentType = 'manager' | 'ralph' | 'researcher';

export interface SdkSessionConfig {
    session_id: string
    agent_type: SdkAgentType
    model: string
    entity_id: string
    entity_type: 'feature' | 'task' | 'chat'
    project_id?: string
    user_id?: string
}

export interface SdkSessionResult {
    content: string
    session_id: string
    tokens_input?: number
    tokens_output?: number
}

export interface SdkSessionInfo {
    session_id: string
    agent_type: SdkAgentType
    entity_id: string
    status: 'active' | 'completed' | 'failed'
    started_at: string
}

/** Event types forwarded to frontend via SSE */
export type SdkEventType =
  | 'agent_output'
  | 'agent_message'
  | 'agent_turn_start'
  | 'agent_turn_end'
  | 'tool_start'
  | 'tool_complete'
  | 'subagent_started'
  | 'subagent_completed'
  | 'usage'
  | 'error'
  | 'session_idle';

export interface SdkEvent {
    type: SdkEventType
    session_id: string
    data: Record<string, unknown>
    timestamp: string
}

/** Tool permission sets per agent type */
export const AGENT_TOOL_PERMISSIONS: Record<SdkAgentType, { allowed: string[], denied: string[] }> = {
    manager: {
        allowed: ['grep', 'glob', 'view'],
        denied: ['edit', 'bash', 'create']
    },
    ralph: {
        allowed: ['grep', 'glob', 'view', 'edit', 'bash', 'create'],
        denied: []
    },
    researcher: {
        allowed: ['grep', 'glob', 'view'],
        denied: ['edit', 'bash', 'create']
    }
};

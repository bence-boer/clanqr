/**
 * Type definitions for the Copilot SDK integration layer.
 * Event types cover the full SDK event surface (69 event types).
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
    billing_multiplier?: number
}

export interface SdkSessionResult {
    content: string
    session_id: string
    prompt_tokens?: number
    completion_tokens?: number
    cache_read?: number
    cache_write?: number
    total_cost?: number
    duration_ms?: number
    files_changed?: string[]
}

export interface SdkSessionInfo {
    session_id: string
    agent_type: SdkAgentType
    entity_id: string
    status: 'active' | 'completed' | 'failed'
    started_at: string
}

/** All event types forwarded to frontend via SSE */
export type SdkEventType =
  | 'agent_output' | 'agent_message' | 'agent_intent'
  | 'agent_reasoning' | 'agent_reasoning_delta'
  | 'agent_turn_start' | 'agent_turn_end'
  | 'tool_start' | 'tool_complete' | 'tool_progress' | 'tool_partial'
  | 'subagent_started' | 'subagent_completed' | 'subagent_failed'
  | 'usage' | 'usage_info' | 'error' | 'warning'
  | 'session_idle' | 'session_shutdown' | 'session_start'
  | 'compaction_start' | 'compaction_complete'
  | 'skill_invoked' | 'permission_requested' | 'permission_completed'
  | 'context_changed' | 'task_complete' | 'title_changed';

export interface SdkEvent {
    type: SdkEventType
    session_id: string
    data: Record<string, unknown>
    timestamp: string
    ephemeral?: boolean
}

/** Tool permission sets per agent type */
export const AGENT_TOOL_PERMISSIONS: Record<SdkAgentType, {
    allowed: string[]
    denied: string[]
}> = {
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

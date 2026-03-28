import type { AgentType, AgentSessionStatus } from './status';

export interface AgentSession {
    id: string
    session_id: string | null
    agent_type: AgentType
    status: AgentSessionStatus
    feature_id: string | null
    task_id: string | null
    user_id: string | null
    model: string | null
    source: string
    prompt_tokens: number
    completion_tokens: number
    cache_read_tokens: number
    cache_write_tokens: number
    duration_ms: number | null
    summary: string | null
    error: string | null
    files_changed: string[] | null
    started_at: string | null
    finished_at: string | null
    created_at: string
    updated_at: string
}

export interface AgentEvent {
    id: string
    agent_session_id: string
    event_type: string
    event_data: Record<string, unknown>
    created_at: string
}

export interface AgentToolCall {
    id: string
    agent_session_id: string
    tool_call_id: string | null
    tool_name: string
    tool_type: string | null
    mcp_server_name: string | null
    arguments: Record<string, unknown> | null
    result_success: boolean | null
    result_summary: string | null
    error_message: string | null
    duration_ms: number | null
    permission_decision: string | null
    was_suppressed: boolean
    created_at: string
}

export interface McpServerConfig {
    id: string
    name: string
    server_type: string
    command: string | null
    args: string[] | null
    env: Record<string, unknown> | null
    url: string | null
    is_global: boolean
    status: string
    created_at: string
    updated_at: string
}

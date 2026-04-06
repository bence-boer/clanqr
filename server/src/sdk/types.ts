/**
 * Type definitions for the Copilot SDK integration layer.
 * V2 agent types support the full orchestrator/implementer/verifier pipeline.
 * Event types cover the full SDK event surface (69 event types).
 */
import { agent_registry_service } from '../services/agent_registry_service';

// ── Agent types ──────────────────────────────────────────────────────────────

export type SdkAgentType =
  | 'orchestrator' | 'explorer' | 'architect' | 'implementer'
  | 'verifier' | 'reviewer' | 'synthesizer' | 'researcher'
  | 'chat' | 'custom';

// ── Session configuration ────────────────────────────────────────────────────

export interface SdkSessionConfig {
    session_id: string
    agent_type: SdkAgentType | string // string for custom/dynamic types
    model: string
    entity_id: string
    entity_type: 'feature' | 'task' | 'chat'
    project_id?: string
    user_id?: string
    billing_multiplier?: number
    cost_per_premium_request?: number
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
    agent_type: SdkAgentType | string
    entity_id: string
    status: 'active' | 'completed' | 'failed'
    started_at: string
}

// ── Event types ──────────────────────────────────────────────────────────────

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

// ── Tool permissions ─────────────────────────────────────────────────────────

/** Hardcoded fallbacks for legacy agent types not yet in the registry */
const LEGACY_TOOL_PERMISSIONS: Record<string, { allowed: string[], denied: string[] }> = {
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

/**
 * Resolve tool permissions for an agent type.
 * Queries the agent registry first; falls back to hardcoded legacy permissions.
 */
export async function get_agent_tool_permissions(
    agent_type: string
): Promise<{ allowed: string[], denied: string[] }> {
    const registry_result = await agent_registry_service.get_tool_permissions(agent_type);
    if (registry_result.allowed.length > 0 || registry_result.denied.length === 0) {
        return registry_result;
    }
    return LEGACY_TOOL_PERMISSIONS[agent_type] ?? { allowed: [], denied: [] };
}

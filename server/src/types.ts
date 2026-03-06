/** Backend domain types — status types imported from shared */

export type {
    FeatureStatus,
    TaskStatus,
    AgentRunStatus,
    AgentRunType,
    ProjectStatus,
    UserRole,
    TraitTarget,
    TraitScope,
    FailureBehavior,
    ResourceStatus
} from '@shared/types';

import type {
    FeatureStatus,
    TaskStatus,
    AgentRunStatus,
    AgentRunType,
    ProjectStatus,
    UserRole,
    TraitTarget,
    TraitScope,
    FailureBehavior,
    ResourceStatus
} from '@shared/types';

export interface ProjectRow {
    id: string
    name: string
    description: string | null
    status: ProjectStatus
    created_at: string
    updated_at: string
}

export interface FeatureRow {
    id: string
    project_id: string
    title: string
    description: string | null
    status: FeatureStatus
    cli: string | null
    planning_model: string | null
    execution_model: string | null
    on_task_failure: FailureBehavior
    auto_approve: boolean
    last_error: string | null
    manager_retry_count: number
    task_timeout_minutes: number
    created_at: string
    updated_at: string
    resources?: ResourceRow[]
    tasks?: TaskRow[]
    projects?: ProjectRow
}

export interface TaskRow {
    id: string
    feature_id: string
    description: string
    status: TaskStatus
    sort_order: number
    model: string | null
    agent_log: string | null
    retry_count: number
    max_retries: number
    created_at: string
    updated_at: string
    features?: FeatureRow & { projects?: ProjectRow }
}

export interface ResourceRow {
    id: string
    feature_id: string
    url: string
    title: string | null
    status: ResourceStatus
    created_at: string
    updated_at: string
}

export interface AgentRunRow {
    id: string
    type: AgentRunType
    task_id: string | null
    feature_id: string | null
    session_id: string | null
    status: AgentRunStatus
    cli: string | null
    model: string | null
    started_at: string
    finished_at: string | null
    duration_ms: number | null
    prompt_tokens: number | null
    completion_tokens: number | null
    log: string | null
    error: string | null
    summary: string | null
    files_changed: string[] | null
    created_at: string
}

export interface PasskeyRow {
    id: string
    credential_id: string
    public_key: string
    counter: number
    device_type: string
    backed_up: boolean
    transports: string[] | null
    display_name: string
    role: UserRole
    created_at: string
}

export interface SessionRow {
    id: string
    passkey_id: string
    token: string
    expires_at: string
}

export interface TraitRow {
    id: string
    name: string
    description: string | null
    target: TraitTarget
    content: string
    is_global: boolean
    created_at: string
    updated_at: string
}

export interface TraitAssignmentRow {
    id: string
    trait_id: string
    scope: TraitScope
    project_id: string | null
    feature_id: string | null
    task_id: string | null
    is_excluded: boolean
    assigned_by: string
    created_at: string
}

export interface ResolvedTrait {
    id: string
    name: string
    description: string | null
    target: string
    content: string
    is_global: boolean
    scope_source: 'global' | 'project' | 'feature' | 'task'
}

export interface ChatSessionRow {
    id: string
    title: string | null
    model: string
    created_at: string
    updated_at: string
}

export interface ChatMessageRow {
    id: string
    session_id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
}

export interface InviteTokenRow {
    id: string
    token: string
    role: UserRole
    label: string | null
    expires_at: string
    used_at: string | null
    created_by_passkey_id: string
    used_by_passkey_id: string | null
    created_at: string
}

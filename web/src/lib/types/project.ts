import type { ProjectStatus, FeatureStatus, TaskStatus, FailureBehavior } from '@shared/types';

export interface Project {
    id: string
    name: string
    description: string | null
    status: ProjectStatus
    created_at: string
    updated_at: string
    features?: Feature[]
}

export interface Feature {
    id: string
    project_id: string
    title: string
    description: string | null
    status: FeatureStatus
    cli: string
    model: string | null
    on_task_failure: FailureBehavior
    auto_approve: boolean
    last_error: string | null
    manager_retry_count: number
    task_timeout_minutes: number
    created_at: string
    updated_at: string
    resources?: Resource[]
    tasks?: Task[]
}

export interface Resource {
    id: string
    feature_id: string
    url: string
    title: string | null
    status: 'Pending' | 'Fetched' | 'Error'
    created_at: string
    updated_at: string
}

export interface Task {
    id: string
    feature_id: string
    description: string
    status: TaskStatus
    agent_log: string | null
    sort_order: number
    retry_count: number
    max_retries: number
    created_at: string
    updated_at: string
}

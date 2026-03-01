import type { TraitTarget, TraitScope } from '@shared/types';

export interface Trait {
    id: string
    name: string
    description: string | null
    target: TraitTarget
    content: string
    is_global: boolean
    created_at: string
    updated_at: string
    assignment_count?: number
}

export interface TraitAssignment {
    id: string
    trait_id: string
    scope: TraitScope
    project_id: string | null
    feature_id: string | null
    task_id: string | null
    is_excluded: boolean
    assigned_by: string
    created_at: string
    traits?: Trait
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

export interface PromptRecord {
    id: string
    role: TraitTarget
    content: string
    version: number
    updated_at: string
}

export interface SkillInfo {
    name: string
    description: string
    path: string
    content: string
    files?: { name: string, content: string }[]
}

export interface SkillLink {
    id: string
    task_id: string
    skill_name: string
    assigned_by: string
    created_at: string
}

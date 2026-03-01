import { api_fetch } from './fetch';
import type {
    AgentRun,
    Feature,
    PipelineStatus,
    Project,
    PromptRecord,
    ResolvedTrait,
    SkillInfo,
    SkillLink,
    SystemAlert,
    SystemStats,
    Task,
    Trait,
    TraitAssignment,
    UsageBreakdown,
    UsageSummary
} from '$lib/types';
import { admin_api } from './admin';

export { api_fetch } from './fetch';

export const api = {
    // ── Projects ──────────────────────────────────────────────────────────────
    list_projects: () => api_fetch<Project[]>('/api/projects'),
    get_project: (id: string) => api_fetch<Project>(`/api/projects/${id}`),
    create_project: (data: { name: string, description?: string }) =>
        api_fetch<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    update_project: (id: string, data: Partial<Project>) =>
        api_fetch<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete_project: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

    // ── Features ──────────────────────────────────────────────────────────────
    list_features: (project_id?: string) => {
        const params = project_id ? `?project_id=${project_id}` : '';
        return api_fetch<Feature[]>(`/api/features${params}`);
    },
    get_feature: (id: string) => api_fetch<Feature>(`/api/features/${id}`),
    create_feature: (data: Partial<Feature>) =>
        api_fetch<Feature>('/api/features', { method: 'POST', body: JSON.stringify(data) }),
    update_feature: (id: string, data: Partial<Feature>) =>
        api_fetch<Feature>(`/api/features/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    submit_feature: (id: string) =>
        api_fetch<Feature>(`/api/features/${id}/submit`, { method: 'POST' }),
    delete_feature: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/features/${id}`, { method: 'DELETE' }),
    add_resource: (feature_id: string, data: { url: string, title?: string }) =>
        api_fetch<{ id: string, feature_id: string, url: string, title: string | null }>(`/api/features/${feature_id}/resources`, {
            method: 'POST', body: JSON.stringify(data)
        }),
    delete_resource: (feature_id: string, resource_id: string) =>
        api_fetch<{ success: boolean }>(`/api/features/${feature_id}/resources/${resource_id}`, { method: 'DELETE' }),

    // ── Tasks ─────────────────────────────────────────────────────────────────
    list_tasks: (feature_id?: string, status?: string) => {
        const params = new URLSearchParams();
        if (feature_id) params.set('feature_id', feature_id);
        if (status) params.set('status', status);
        const qs = params.toString();
        return api_fetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
    },
    approve_task: (id: string) => api_fetch<Task>(`/api/tasks/${id}/approve`, { method: 'POST' }),
    spawn_ralph: (id: string) => api_fetch<{ success: boolean }>(`/api/tasks/${id}/run`, { method: 'POST' }),
    approve_all_tasks: (feature_id: string) =>
        api_fetch<Task[]>(`/api/tasks/approve-all/${feature_id}`, { method: 'POST' }),
    create_task: (data: { feature_id: string, description: string }) =>
        api_fetch<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update_task: (id: string, data: { description?: string }) =>
        api_fetch<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete_task: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),

    // ── Agents / Pipeline ─────────────────────────────────────────────────────
    agent_status: () => api_fetch<Record<string, AgentRun>>('/api/agents/status'),
    feature_agent_status: (feature_id: string) =>
        api_fetch<{ processes: AgentRun[], pipeline: { state: string, is_active_feature: boolean, current_task_id: string | null } }>(`/api/agents/feature/${feature_id}`),
    agent_log: (task_id: string) => api_fetch<{ log: string }>(`/api/agents/log/${task_id}`),
    spawn_manager: (feature_id: string) =>
        api_fetch<{ success: boolean }>(`/api/agents/spawn/manager/${feature_id}`, { method: 'POST' }),
    stop_all_agents: () => api_fetch<{ success: boolean }>('/api/agents/stop-all', { method: 'POST' }),
    stop_agent: (task_id: string) =>
        api_fetch<{ success: boolean }>(`/api/agents/stop/${task_id}`, { method: 'POST' }),
    pipeline_status: () => api_fetch<PipelineStatus>('/api/agents/queue'),
    pipeline_log: () => api_fetch<{ log: string }>('/api/agents/queue/log'),
    pipeline_pause: () => api_fetch<{ success: boolean }>('/api/agents/pause', { method: 'POST' }),
    pipeline_resume: () => api_fetch<{ success: boolean }>('/api/agents/resume', { method: 'POST' }),
    pipeline_stop_current: () => api_fetch<{ success: boolean }>('/api/agents/stop-current', { method: 'POST' }),

    // ── Prompts ───────────────────────────────────────────────────────────────
    list_prompts: () => api_fetch<PromptRecord[]>('/api/prompts'),
    get_prompt: (role: string) => api_fetch<PromptRecord>(`/api/prompts/${role}`),
    update_prompt: (role: string, content: string) =>
        api_fetch<PromptRecord>(`/api/prompts/${role}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    sync_prompts: () => api_fetch<{ success: boolean }>('/api/prompts/sync', { method: 'POST' }),

    // ── Traits ────────────────────────────────────────────────────────────────
    list_traits: (target?: 'manager' | 'ralph') => {
        const params = target ? `?target=${target}` : '';
        return api_fetch<Trait[]>(`/api/traits${params}`);
    },
    get_trait: (id: string) => api_fetch<Trait>(`/api/traits/${id}`),
    create_trait: (data: Omit<Trait, 'id' | 'created_at' | 'updated_at'>) =>
        api_fetch<Trait>('/api/traits', { method: 'POST', body: JSON.stringify(data) }),
    update_trait: (id: string, data: Partial<Trait>) =>
        api_fetch<Trait>(`/api/traits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete_trait: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/traits/${id}`, { method: 'DELETE' }),
    assign_trait: (data: Partial<TraitAssignment>) =>
        api_fetch<TraitAssignment>('/api/traits/assign', { method: 'POST', body: JSON.stringify(data) }),
    remove_trait_assignment: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/traits/assign/${id}`, { method: 'DELETE' }),
    resolve_task_traits: (task_id: string) =>
        api_fetch<ResolvedTrait[]>(`/api/traits/resolve/${task_id}`),
    resolve_feature_traits: (feature_id: string) =>
        api_fetch<ResolvedTrait[]>(`/api/traits/resolve/feature/${feature_id}`),
    list_trait_assignments: (params: { scope?: string, task_id?: string, feature_id?: string, project_id?: string }) => {
        const qs = new URLSearchParams();
        if (params.scope) qs.set('scope', params.scope);
        if (params.task_id) qs.set('task_id', params.task_id);
        if (params.feature_id) qs.set('feature_id', params.feature_id);
        if (params.project_id) qs.set('project_id', params.project_id);
        return api_fetch<TraitAssignment[]>(`/api/traits/assign?${qs}`);
    },

    // ── Skills ────────────────────────────────────────────────────────────────
    list_skills: () => api_fetch<Omit<SkillInfo, 'content'>[]>('/api/skills'),
    get_skill: (name: string) => api_fetch<SkillInfo>(`/api/skills/${encodeURIComponent(name)}`),
    refresh_skills: () => api_fetch<{ refreshed: number }>('/api/skills/refresh', { method: 'POST' }),
    get_task_skills: (task_id: string) => api_fetch<SkillLink[]>(`/api/skills/task/${task_id}`),
    link_skill: (task_id: string, skill_name: string) =>
        api_fetch<SkillLink>('/api/skills/link', { method: 'POST', body: JSON.stringify({ task_id, skill_name }) }),
    unlink_skill: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/skills/link/${id}`, { method: 'DELETE' }),

    // ── System ────────────────────────────────────────────────────────────────
    system_stats: () => api_fetch<SystemStats>('/api/system/stats'),
    system_alerts: () => api_fetch<{ alerts: SystemAlert[] }>('/api/system/alerts'),
    list_models: (cli = 'copilot') => api_fetch<{ value: string, label: string }[]>(`/api/system/models?cli=${cli}`),

    // ── Usage ─────────────────────────────────────────────────────────────────
    usage_summary: () => api_fetch<UsageSummary>('/api/usage/summary'),
    usage_history: (page = 1, per_page = 20, type?: string, status?: string) => {
        const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
        if (type) params.set('type', type);
        if (status) params.set('status', status);
        return api_fetch<{ runs: AgentRun[], total: number, page: number, per_page: number, total_pages: number }>(
            `/api/usage/history?${params}`
        );
    },
    usage_breakdown: () => api_fetch<UsageBreakdown>('/api/usage/breakdown'),

    // ── Chat ──────────────────────────────────────────────────────────────────
    ...admin_api
};

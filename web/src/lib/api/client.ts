import { auth_store } from '$lib/stores/auth.svelte';
import { toast_store } from '$lib/stores/toast.svelte';
import type * as Types from '$lib/types';
import { API_URL, BASE_URL, client, unwrap } from './rpc';

export { BASE_URL, client };

export const api = {
    // ── Projects ──────────────────────────────────────────────────────────────
    list_projects: async (): Promise<Types.Project[]> =>
        unwrap(await (await client.api.projects.$get()).json()),
    get_project: async (id: string) =>
        unwrap(await (await client.api.projects[':id'].$get({ param: { id } })).json()),
    create_project: async (data: { name: string, description?: string }): Promise<Types.Project> =>
        unwrap(await (await client.api.projects.$post({ json: data })).json()),
    update_project: async (id: string, data: { name?: string, description?: string | null }): Promise<Types.Project> =>
        unwrap(await (await client.api.projects[':id'].$patch({ param: { id }, json: data })).json()),
    delete_project: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.projects[':id'].$delete({ param: { id } })).json()),

    // ── Features ──────────────────────────────────────────────────────────────
    list_features: async (project_id?: string): Promise<Types.Feature[]> =>
        unwrap(await (await client.api.features.$get({ query: { project_id: project_id ?? '' } })).json()),
    get_feature: async (id: string): Promise<Types.Feature> =>
        unwrap(await (await client.api.features[':id'].$get({ param: { id } })).json()),
    create_feature: async (data: Record<string, unknown>) =>
        unwrap(await (await client.api.features.$post({ json: data as never })).json()),
    update_feature: async (id: string, data: Record<string, unknown>): Promise<Types.Feature> =>
        unwrap(await (await client.api.features[':id'].$patch({ param: { id }, json: data as never })).json()),
    submit_feature: async (id: string): Promise<Types.Feature> =>
        unwrap(await (await client.api.features[':id'].submit.$post({ param: { id } })).json()),
    delete_feature: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.features[':id'].$delete({ param: { id } })).json()),
    add_resource: async (feature_id: string, data: { url: string, title?: string }) =>
        unwrap(await (await client.api.features[':id'].resources.$post({ param: { id: feature_id }, json: data })).json()),
    delete_resource: async (feature_id: string, resource_id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.features[':feature_id'].resources[':id'].$delete({ param: { feature_id, id: resource_id } })).json()),

    // ── Tasks ─────────────────────────────────────────────────────────────────
    list_tasks: async (feature_id?: string, status?: string): Promise<Types.Task[]> =>
        unwrap(await (await client.api.tasks.$get({ query: { feature_id: feature_id ?? '', status: status ?? '' } })).json()),
    approve_task: async (id: string) =>
        unwrap(await (await client.api.tasks[':id'].approve.$post({ param: { id } })).json()),
    spawn_ralph: async (id: string) =>
        unwrap(await (await client.api.tasks[':id'].run.$post({ param: { id } })).json()),
    approve_all_tasks: async (feature_id: string) =>
        unwrap(await (await client.api.tasks['approve-all'][':feature_id'].$post({ param: { feature_id } })).json()),
    create_task: async (data: { feature_id: string, description: string }): Promise<Types.TaskRow> =>
        unwrap(await (await client.api.tasks.$post({ json: data })).json()),
    update_task: async (id: string, data: { description?: string, model?: string | null }): Promise<Types.TaskRow> =>
        unwrap(await (await client.api.tasks[':id'].$patch({ param: { id }, json: data })).json()),
    delete_task: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.tasks[':id'].$delete({ param: { id } })).json()),

    // ── Agents / Pipeline ─────────────────────────────────────────────────────
    agent_status: async (): Promise<Record<string, Types.AgentProcess>> =>
        unwrap(await (await client.api.agents.status.$get()).json()),
    feature_agent_status: async (feature_id: string): Promise<Types.FeatureAgentStatus> =>
        unwrap(await (await client.api.agents.feature[':feature_id'].$get({ param: { feature_id } })).json()),
    agent_log: async (task_id: string): Promise<{ task_id: string, log: string }> =>
        unwrap(await (await client.api.agents.log[':task_id'].$get({ param: { task_id } })).json()),
    spawn_manager: async (feature_id: string): Promise<{ success: boolean, message: string }> =>
        unwrap(await (await client.api.agents.spawn.manager[':feature_id'].$post({ param: { feature_id } })).json()),
    stop_all_agents: async (): Promise<{ success: boolean, message: string }> =>
        unwrap(await (await client.api.agents['stop-all'].$post()).json()),
    stop_agent: async (task_id: string): Promise<{ success: boolean, message: string }> =>
        unwrap(await (await client.api.agents.stop[':task_id'].$post({ param: { task_id } })).json()),
    pipeline_status: async (): Promise<Types.PipelineStatus> =>
        unwrap(await (await client.api.agents.queue.$get()).json()),
    pipeline_log: async (): Promise<{ log: string }> =>
        unwrap(await (await client.api.agents.queue.log.$get()).json()),
    pipeline_pause: async (): Promise<{ success: boolean, state: string }> =>
        unwrap(await (await client.api.agents.pause.$post()).json()),
    pipeline_resume: async (): Promise<{ success: boolean, state: string }> =>
        unwrap(await (await client.api.agents.resume.$post()).json()),
    pipeline_stop_current: async (): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.agents['stop-current'].$post()).json()),

    // ── Prompts ───────────────────────────────────────────────────────────────
    list_prompts: async (): Promise<Types.PromptRecord[]> =>
        unwrap(await (await client.api.prompts.$get()).json()),
    get_prompt: async (role: string): Promise<Types.PromptRecord> =>
        unwrap(await (await client.api.prompts[':role'].$get({ param: { role } })).json()),
    update_prompt: async (role: string, content: string) =>
        unwrap(await (await client.api.prompts[':role'].$patch({ param: { role }, json: { content } })).json()),
    sync_prompts: async (): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.prompts.sync.$post()).json()),

    // ── Traits ────────────────────────────────────────────────────────────────
    list_traits: async (target?: 'manager' | 'ralph'): Promise<Types.Trait[]> =>
        unwrap(await (await client.api.traits.$get({ query: { target: target ?? '' } })).json()),
    get_trait: async (id: string): Promise<Types.Trait> =>
        unwrap(await (await client.api.traits[':id'].$get({ param: { id } })).json()),
    create_trait: async (data: { name: string, description?: string, target: Types.TraitTarget, content: string, is_global?: boolean }): Promise<Types.Trait> =>
        unwrap(await (await client.api.traits.$post({ json: data })).json()),
    update_trait: async (id: string, data: Record<string, unknown>): Promise<Types.Trait> =>
        unwrap(await (await client.api.traits[':id'].$patch({ param: { id }, json: data })).json()),
    delete_trait: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.traits[':id'].$delete({ param: { id } })).json()),
    assign_trait: async (data: Record<string, unknown>): Promise<Types.TraitAssignment> =>
        unwrap(await (await client.api.traits.assign.$post({ json: data as never })).json()),
    remove_trait_assignment: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.traits.assign[':id'].$delete({ param: { id } })).json()),
    resolve_task_traits: async (task_id: string): Promise<Types.ResolvedTrait[]> =>
        unwrap(await (await client.api.traits.resolve[':task_id'].$get({ param: { task_id } })).json()),
    resolve_feature_traits: async (feature_id: string): Promise<Types.ResolvedTrait[]> =>
        unwrap(await (await client.api.traits.resolve.feature[':id'].$get({ param: { id: feature_id } })).json()),
    list_trait_assignments: async (params: { scope?: string, task_id?: string, feature_id?: string, project_id?: string }): Promise<Types.TraitAssignment[]> =>
        unwrap(await (await client.api.traits.assign.$get({ query: params as never })).json()),

    // ── Skills ────────────────────────────────────────────────────────────────
    list_skills: async (): Promise<Types.SkillInfoListItem[]> =>
        unwrap(await (await client.api.skills.$get()).json()),
    get_skill: async (name: string): Promise<Types.SkillInfo> =>
        unwrap(await (await client.api.skills[':name'].$get({ param: { name } })).json()),
    refresh_skills: async () =>
        unwrap(await (await client.api.skills.refresh.$post()).json()),
    get_task_skills: async (task_id: string): Promise<Types.SkillLink[]> =>
        unwrap(await (await client.api.skills.task[':task_id'].$get({ param: { task_id } })).json()),
    link_skill: async (task_id: string, skill_name: string): Promise<Types.SkillLink> =>
        unwrap(await (await client.api.skills.link.$post({ json: { task_id, skill_name } as never })).json()),
    unlink_skill: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.skills.link[':id'].$delete({ param: { id } })).json()),

    // ── System ────────────────────────────────────────────────────────────────
    system_stats: async (): Promise<Types.SystemStats> =>
        unwrap(await (await client.api.system.stats.$get()).json()),
    system_alerts: async (): Promise<Types.SystemAlerts> =>
        unwrap(await (await client.api.system.alerts.$get()).json()),
    list_models: async (cli = 'copilot'): Promise<Types.ModelOption[]> =>
        unwrap(await (await client.api.system.models.$get({ query: { cli } } as never)).json()),

    // ── Usage ─────────────────────────────────────────────────────────────────
    usage_summary: async (): Promise<Types.UsageSummary> =>
        unwrap(await (await client.api.usage.summary.$get()).json()),
    usage_history: async (page = 1, per_page = 20, type?: string, status?: string): Promise<{ runs: Types.AgentRun[], total: number, total_pages: number }> =>
        unwrap(await (await client.api.usage.history.$get({
            query: {
                page: String(page),
                per_page: String(per_page),
                type: type ?? '',
                status: status ?? ''
            }
        })).json()),
    usage_breakdown: async (): Promise<Types.UsageBreakdown> =>
        unwrap(await (await client.api.usage.breakdown.$get()).json()),

    // ── Chat ──────────────────────────────────────────────────────────────────
    list_chat_sessions: async (): Promise<Types.ChatSession[]> =>
        unwrap(await (await client.api.chat.sessions.$get()).json()),
    get_chat_session: async (id: string): Promise<Types.ChatSession & { chat_messages?: Types.ChatMessage[] | null }> =>
        unwrap(await (await client.api.chat.sessions[':id'].$get({ param: { id } })).json()),
    create_chat_session: async (data: { title?: string, model?: string }): Promise<Types.ChatSession> =>
        unwrap(await (await client.api.chat.sessions.$post({ json: data as never })).json()),
    delete_chat_session: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.chat.sessions[':id'].$delete({ param: { id } })).json()),
    send_chat_message: async (session_id: string, content: string, model?: string): Promise<Response> => {
        const response = await fetch(`${API_URL}/api/chat/sessions/${encodeURIComponent(session_id)}/send`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, ...(model ? { model } : {}) })
        });
        if (response.status === 401) {
            auth_store.state = 'login';
            auth_store.role = null;
            auth_store.passkey_id = null;
            toast_store.error('Session expired — please sign in again');
            throw new Error('Session expired');
        }
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({ error: response.statusText }));
            let msg = `API error: ${response.status}`;
            if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
                msg = body.error;
            }
            throw new Error(msg);
        }
        return response;
    },
    cancel_chat: async (session_id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.chat.sessions[':id'].cancel.$post({ param: { id: session_id } })).json()),
    chat_stream_url: (session_id: string): string =>
        `${API_URL}/api/chat/sessions/${encodeURIComponent(session_id)}/stream`,

    // ── Admin ─────────────────────────────────────────────────────────────────
    list_users: async (): Promise<Types.User[]> =>
        unwrap(await (await client.api.admin.$get()).json()),
    update_user_role: async (id: string, role: 'admin' | 'user') =>
        unwrap(await (await client.api.admin[':id'].$patch({ param: { id }, json: { role } })).json()),
    delete_user: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.admin[':id'].$delete({ param: { id } })).json()),
    list_invites: async (): Promise<Types.InviteToken[]> =>
        unwrap(await (await client.api.admin.invites.$get()).json()),
    create_invite: async (data: { role: string, expires_at: string, label?: string }) =>
        unwrap(await (await client.api.admin.invites.$post({ json: data as never })).json()),
    revoke_invite: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.admin.invites[':id'].$delete({ param: { id } })).json()),
    revoke_user_sessions: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.admin[':id'].sessions.$delete({ param: { id } })).json()),
    clear_old_invites: async () =>
        unwrap(await (await client.api.admin.invites['bulk-clear'].$delete()).json()),
    get_invite_status: async (token: string): Promise<Types.InviteStatus> => {
        const response = await fetch(`${API_URL}/api/auth/invite/status?token=${encodeURIComponent(token)}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to check invite status: ${response.status}`);
        }
        return response.json();
    }
};

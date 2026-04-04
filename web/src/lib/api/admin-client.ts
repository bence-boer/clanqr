/** Admin API client — users, invites, settings (admin-only endpoints). */
import type * as Types from '$lib/types';
import { API_URL, client, custom_fetch, unwrap } from './rpc';

export const admin_api = {
    // ── Users ────────────────────────────────────────────────────────────────
    list_users: async (): Promise<Types.User[]> =>
        unwrap(await (await client.api.admin.$get()).json()),
    update_user_role: async (id: string, role: 'admin' | 'member') =>
        unwrap(await (await client.api.admin[':id'].$patch({ param: { id }, json: { role } })).json()),
    delete_user: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.admin[':id'].$delete({ param: { id } })).json()),
    revoke_user_sessions: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.admin[':id'].sessions.$delete({ param: { id } })).json()),

    // ── Invites ──────────────────────────────────────────────────────────────
    create_invite: async (expires_in_days?: number) => {
        const response = await custom_fetch(`${API_URL}/api/admin/invites`, {
            method: 'POST',
            body: JSON.stringify(expires_in_days ? { expires_in_days } : {})
        });
        return response.json();
    },
    list_invites: async () => {
        const response = await custom_fetch(`${API_URL}/api/admin/invites`);
        return response.json();
    },
    revoke_invite: async (id: string): Promise<{ success: boolean }> => {
        const response = await custom_fetch(`${API_URL}/api/admin/invites/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    get_settings: async (): Promise<Types.SdkDefaults> => {
        const response = await custom_fetch(`${API_URL}/api/admin/settings`);
        return response.json();
    },
    update_settings: async (updates: Partial<Types.SdkDefaults>): Promise<Types.SdkDefaults> => {
        const response = await custom_fetch(`${API_URL}/api/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return response.json();
    },

    // ── Metrics & Maintenance ────────────────────────────────────────────────
    load_metrics: async (): Promise<Record<string, { total_requests: number, total_errors: number, avg_latency_ms: number, p95_latency_ms: number }>> => {
        const response = await custom_fetch(`${API_URL}/api/admin/metrics`);
        return response.json();
    },
    cleanup_workspaces: async (): Promise<{ cleaned: number }> => {
        const response = await custom_fetch(`${API_URL}/api/admin/cleanup-workspaces`, {
            method: 'POST'
        });
        return response.json();
    }
};

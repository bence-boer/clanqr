/** Admin API client — users, invites, settings (admin-only endpoints). */
import type * as Types from '$lib/types';
import { API_URL, client, unwrap } from './rpc';

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
        const response = await fetch(`${API_URL}/api/admin/invites`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expires_in_days ? { expires_in_days } : {})
        });
        if (!response.ok) throw new Error('Failed to create invite');
        return response.json();
    },
    list_invites: async () => {
        const response = await fetch(`${API_URL}/api/admin/invites`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to list invites');
        return response.json();
    },
    revoke_invite: async (id: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_URL}/api/admin/invites/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to revoke invite');
        return response.json();
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    get_settings: async (): Promise<Types.SdkDefaults> => {
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load settings');
        return response.json();
    },
    update_settings: async (updates: Partial<Types.SdkDefaults>): Promise<Types.SdkDefaults> => {
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!response.ok) throw new Error('Failed to save settings');
        return response.json();
    }
};

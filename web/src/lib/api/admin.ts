import { api_fetch, BASE_URL } from './fetch';
import { auth_store } from '$lib/stores/auth.svelte';
import { toast_store } from '$lib/stores/toast.svelte';
import type { User, InviteToken, InviteStatus, ChatSession, ChatMessage } from '$lib/types';

export const admin_api = {
    // ── Chat ──────────────────────────────────────────────────────────────────
    list_chat_sessions: () => api_fetch<ChatSession[]>('/api/chat/sessions'),
    get_chat_session: (id: string) =>
        api_fetch<ChatSession & { messages: ChatMessage[] }>(`/api/chat/sessions/${id}`),
    create_chat_session: (data: { title?: string, model?: string }) =>
        api_fetch<ChatSession>('/api/chat/sessions', { method: 'POST', body: JSON.stringify(data) }),
    delete_chat_session: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/chat/sessions/${id}`, { method: 'DELETE' }),
    send_chat_message: async (session_id: string, content: string, model?: string): Promise<Response> => {
        const response = await fetch(`${BASE_URL}/api/chat/sessions/${session_id}/send`, {
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
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error ?? `API error: ${response.status}`);
        }
        return response;
    },
    cancel_chat: (session_id: string) =>
        api_fetch<{ success: boolean }>(`/api/chat/sessions/${session_id}/cancel`, { method: 'POST' }),
    chat_stream_url: (session_id: string) =>
        `${BASE_URL}/api/chat/sessions/${session_id}/stream`,

    // ── Admin ─────────────────────────────────────────────────────────────────
    list_users: () => api_fetch<User[]>('/api/admin'),
    update_user_role: (id: string, role: string) =>
        api_fetch<User>(`/api/admin/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    delete_user: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/admin/${id}`, { method: 'DELETE' }),
    list_invites: () => api_fetch<InviteToken[]>('/api/admin/invites'),
    create_invite: (data: { role: string, expires_at: string, label?: string }) =>
        api_fetch<InviteToken & { token: string }>('/api/admin/invites', { method: 'POST', body: JSON.stringify(data) }),
    revoke_invite: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/admin/invites/${id}`, { method: 'DELETE' }),
    revoke_user_sessions: (id: string) =>
        api_fetch<{ success: boolean }>(`/api/admin/${id}/sessions`, { method: 'DELETE' }),
    clear_old_invites: () =>
        api_fetch<{ deleted: number }>('/api/admin/invites/bulk-clear', { method: 'DELETE' }),
    get_invite_status: async (token: string) => {
        const response = await fetch(`${BASE_URL}/api/auth/invite/status?token=${encodeURIComponent(token)}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to check invite status: ${response.status}`);
        }
        return response.json() as Promise<InviteStatus>;
    }
};

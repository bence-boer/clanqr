import { auth_store } from '$lib/stores/auth.svelte';
import { toast_store } from '$lib/stores/toast.svelte';
import type * as Types from '$lib/types';
import { API_URL, client, unwrap } from './rpc';

export const chat_api = {
    list_chat_sessions: async (): Promise<Types.ChatSession[]> =>
        unwrap(await (await client.api.chat.sessions.$get()).json()),
    get_chat_session: async (id: string): Promise<Types.ChatSession & { chat_messages?: Types.ChatMessage[] | null }> =>
        unwrap(await (await client.api.chat.sessions[':id'].$get({ param: { id } })).json()),
    create_chat_session: async (data: { title?: string, model?: string }): Promise<Types.ChatSession> =>
        unwrap(await (await client.api.chat.sessions.$post({ json: data as never })).json()),
    delete_chat_session: async (id: string): Promise<{ success: boolean }> =>
        unwrap(await (await client.api.chat.sessions[':id'].$delete({ param: { id } })).json()),
    rename_chat_session: async (id: string, title: string): Promise<Types.ChatSession> => {
        const response = await fetch(`${API_URL}/api/chat/sessions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error('Failed to rename session');
        return response.json();
    },
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
        `${API_URL}/api/chat/sessions/${encodeURIComponent(session_id)}/stream`
};

import type * as Types from '$lib/types';
import { API_URL, client, custom_fetch, unwrap } from './rpc';

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
        const response = await custom_fetch(`${API_URL}/api/chat/sessions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ title })
        });
        return response.json();
    },
    send_chat_message: async (session_id: string, content: string, model?: string): Promise<Response> => {
        const response = await custom_fetch(`${API_URL}/api/chat/sessions/${encodeURIComponent(session_id)}/send`, {
            method: 'POST',
            body: JSON.stringify({ content, ...(model ? { model } : {}) })
        });
        return response;
    },
    chat_stream_url: (session_id: string): string =>
        `${API_URL}/api/chat/sessions/${encodeURIComponent(session_id)}/stream`
};

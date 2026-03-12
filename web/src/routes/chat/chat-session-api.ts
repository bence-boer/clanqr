import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';
import type { ChatSession, ChatSessionFull } from '$lib/types';

export async function fetch_sessions(): Promise<ChatSession[]> {
    try {
        return await api.list_chat_sessions();
    }
    catch {
        toast_store.error('Failed to load chat sessions');
        return [];
    }
}

export async function fetch_session_detail(session_id: string): Promise<ChatSessionFull | null> {
    try {
        const { chat_messages, ...rest } = await api.get_chat_session(session_id);
        return { ...rest, messages: chat_messages ?? [] };
    }
    catch {
        toast_store.error('Failed to load messages');
        return null;
    }
}

export async function create_new_session(model: string): Promise<ChatSession | null> {
    try {
        return await api.create_chat_session({ model });
    }
    catch {
        toast_store.error('Failed to create session');
        return null;
    }
}

export async function remove_session(session_id: string): Promise<boolean> {
    try {
        await api.delete_chat_session(session_id);
        return true;
    }
    catch {
        toast_store.error('Failed to delete session');
        return false;
    }
}

export async function update_session_title(session_id: string, title: string): Promise<ChatSession | null> {
    try {
        return await api.rename_chat_session(session_id, title);
    }
    catch {
        toast_store.error('Failed to rename session');
        return null;
    }
}

export async function cancel_chat_stream(session_id: string): Promise<void> {
    try {
        await api.cancel_chat(session_id);
    }
    catch {
        /* best-effort cancel */
    }
}

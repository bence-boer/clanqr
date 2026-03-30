import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';
import type { ChatMessage, ChatSession, ChatSessionFull } from '$lib/types';

export async function fetch_sessions(): Promise<ChatSession[]> {
    try {
        const raw = await api.list_chat_sessions();
        return raw.map((s) => ({
            id: s.id,
            title: s.title ?? null,
            model: s.model ?? null,
            created_at: s.created_at,
            updated_at: s.updated_at
        }));
    }
    catch {
        toast_store.error('Failed to load chat sessions');
        return [];
    }
}

export async function fetch_session_detail(session_id: string): Promise<ChatSessionFull | null> {
    try {
        const raw = await api.get_chat_session(session_id);
        const messages: ChatMessage[] = (raw.chat_messages ?? []).map((e: Record<string, unknown>) => {
            const data = (e.event_data ?? e) as Record<string, unknown>;
            return {
                id: e.id as string,
                role: (data.role ?? e.role ?? 'user') as ChatMessage['role'],
                content: (data.content ?? e.content ?? '') as string,
                created_at: e.created_at as string
            };
        });
        return {
            id: raw.id,
            title: raw.title ?? null,
            model: raw.model ?? null,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
            messages
        };
    }
    catch {
        toast_store.error('Failed to load messages');
        return null;
    }
}

export async function create_new_session(model: string): Promise<ChatSession | null> {
    try {
        const raw = await api.create_chat_session({ model });
        return {
            id: raw.id,
            title: raw.title ?? null,
            model: raw.model ?? null,
            created_at: raw.created_at,
            updated_at: raw.updated_at
        };
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
        const raw = await api.rename_chat_session(session_id, title);
        return {
            id: raw.id,
            title: raw.title ?? null,
            model: raw.model ?? null,
            created_at: raw.created_at,
            updated_at: raw.updated_at
        };
    }
    catch {
        toast_store.error('Failed to rename session');
        return null;
    }
}

export async function cancel_chat_stream(): Promise<void> {
    // SDK-backed chat doesn't support mid-stream cancellation
}

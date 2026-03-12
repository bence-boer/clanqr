<script lang="ts">
    import { onMount } from 'svelte';
    import { api } from '$lib/api/client';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { read_sse_stream } from '$lib/utils/sse';
    import { generate_id } from '$lib/utils/id';
    import type { ChatSession, ChatSessionFull, ChatMessage } from '$lib/types';
    import SessionList from './SessionList.svelte';
    import ChatActions from './ChatActions.svelte';

    const models = [
        {
            group: 'Claude',
            models: [
                'claude-sonnet-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5',
                'claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5', 'claude-sonnet-4'
            ]
        },
        { group: 'Gemini', models: ['gemini-3-pro-preview'] },
        {
            group: 'GPT',
            models: [
                'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max',
                'gpt-5.1-codex', 'gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5-mini', 'gpt-4.1'
            ]
        }
    ];

    let sessions = $state<ChatSession[]>([]);
    let active_session = $state<ChatSessionFull | null>(null);
    let messages = $state<ChatMessage[]>([]);
    let input_text = $state('');
    let selected_model = $state('claude-sonnet-4.5');
    let is_streaming = $state(false);
    let streaming_content = $state('');
    let loading_sessions = $state(true);
    let loading_messages = $state(false);
    let error_msg = $state('');
    let mobile_sessions_open = $state(false);

    onMount(() => {
        load_sessions().then(() => {
            const saved_id = sessionStorage.getItem('active_chat_session');
            if (saved_id) {
                const saved = sessions.find((s) => s.id === saved_id);
                if (saved) select_session(saved);
            }
        });
    });

    async function load_sessions() {
        try {
            sessions = await api.list_chat_sessions();
        }
        catch {
            toast_store.error('Failed to load chat sessions');
        }
        finally {
            loading_sessions = false;
        }
    }

    async function select_session(session: ChatSession) {
        active_session = { ...session, messages: [] };
        selected_model = session.model;
        sessionStorage.setItem('active_chat_session', session.id);
        loading_messages = true;
        messages = [];
        mobile_sessions_open = false;
        try {
            const { chat_messages, ...rest } = await api.get_chat_session(session.id);
            const full_session: ChatSessionFull = {
                ...rest,
                messages: chat_messages ?? []
            };
            messages = full_session.messages;
            active_session = full_session;
        }
        catch {
            error_msg = 'Failed to load messages';
            toast_store.error(error_msg);
        }
        finally {
            loading_messages = false;
        }
    }

    async function create_session() {
        try {
            const session = await api.create_chat_session({ model: selected_model });
            sessions = [session, ...sessions];
            await select_session(session);
        }
        catch {
            error_msg = 'Failed to create session';
            toast_store.error(error_msg);
        }
    }

    async function delete_session(session_id: string, event: MouseEvent) {
        event.stopPropagation();
        if (!confirm('Delete this session?')) return;
        try {
            await api.delete_chat_session(session_id);
            sessions = sessions.filter((s) => s.id !== session_id);
            if (active_session?.id === session_id) {
                active_session = null;
                messages = [];
                sessionStorage.removeItem('active_chat_session');
            }
        }
        catch {
            error_msg = 'Failed to delete session';
            toast_store.error(error_msg);
        }
    }

    async function rename_session(session_id: string, title: string) {
        try {
            const updated = await api.rename_chat_session(session_id, title);
            sessions = sessions.map((s) => s.id === session_id ? { ...s, title: updated.title } : s);
            if (active_session?.id === session_id) {
                active_session = { ...active_session, title: updated.title };
            }
        }
        catch {
            toast_store.error('Failed to rename session');
        }
    }

    async function send_message() {
        if (!input_text.trim() || !active_session || is_streaming) return;
        const session_id = active_session.id;
        const message_content = input_text.trim();
        input_text = '';
        error_msg = '';
        is_streaming = true;
        streaming_content = '';
        const user_message: ChatMessage = {
            id: generate_id(), session_id,
            role: 'user', content: message_content, created_at: new Date().toISOString()
        };
        messages = [...messages, user_message];
        try {
            const response = await api.send_chat_message(session_id, message_content, selected_model);
            await read_sse_stream(response, {
                on_chunk: (chunk) => {
                    streaming_content += chunk;
                },
                on_error: (err) => {
                    error_msg = err;
                }
            });
            if (streaming_content) {
                messages = [...messages, {
                    id: generate_id(), session_id,
                    role: 'assistant', content: streaming_content, created_at: new Date().toISOString()
                }];
            }
            streaming_content = '';
            is_streaming = false;
            load_sessions();
        }
        catch {
            // Preserve partial streaming content as an assistant message (§14.1)
            if (streaming_content) {
                messages = [...messages, {
                    id: generate_id(), session_id,
                    role: 'assistant', content: streaming_content + '\n\n*(response interrupted)*',
                    created_at: new Date().toISOString()
                }];
                streaming_content = '';
            }
            else {
                messages = messages.filter((m) => m.id !== user_message.id);
            }
            error_msg = 'Failed to send message';
            is_streaming = false;
        }
    }

    function format_session_title(session: ChatSession) {
        return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
    }

    async function stop_generating() {
        if (!active_session || !is_streaming) return;
        try {
            await api.cancel_chat(active_session.id);
        }
        catch {
            /* Best-effort cancel */
        }
        if (streaming_content) {
            messages = [...messages, {
                id: generate_id(), session_id: active_session.id,
                role: 'assistant', content: streaming_content + '\n\n*(generation stopped)*',
                created_at: new Date().toISOString()
            }];
        }
        streaming_content = '';
        is_streaming = false;
    }

    function toggle_mobile_sessions() {
        mobile_sessions_open = !mobile_sessions_open;
    }
</script>

<div class="chat-page">
    <button class="mobile-sessions-toggle" onclick={toggle_mobile_sessions} aria-label="Toggle sessions">
        <span class="icon" style="font-size: 20px">{mobile_sessions_open ? 'close' : 'menu'}</span>
    </button>
    <div class="sessions-container" class:mobile-open={mobile_sessions_open}>
        <SessionList {sessions} {active_session} {loading_sessions} onselect={select_session} ondelete={delete_session} oncreate={create_session} />
    </div>
    <ChatActions
        session={active_session} {messages} {loading_messages} {is_streaming} {streaming_content}
        bind:input_text bind:selected_model {error_msg} {models}
        {format_session_title} on_send={send_message} on_stop={stop_generating} on_create={create_session} on_rename={rename_session}
    />
</div>

<style>
    .chat-page {
        display: flex;
        height: 100%;
        gap: 0;
        background: var(--bg);
        position: relative;
    }

    .sessions-container {
        display: contents;
    }

    .mobile-sessions-toggle {
        display: none;
        position: absolute;
        top: 0.65rem;
        left: 0.65rem;
        z-index: 20;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        padding: 0.3rem;
        cursor: pointer;
        line-height: 1;
    }

    @media (max-width: 768px) {
        .chat-page {
            flex-direction: column;
            min-height: 0;
        }

        .mobile-sessions-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .sessions-container {
            display: none;
        }

        .sessions-container.mobile-open {
            display: contents;
        }
    }
</style>

<script lang="ts">
    import { onMount } from 'svelte';
    import { api } from '$lib/api/client';
    import { read_sse_stream } from '$lib/utils/sse';
    import type { ChatSession, ChatSessionFull, ChatMessage } from '$lib/types';
    import { chat_models, format_session_title, build_message } from './chat-models';
    import {
        fetch_sessions, fetch_session_detail, create_new_session,
        remove_session, update_session_title, cancel_chat_stream
    } from './chat-session-api';
    import SessionList from './SessionList.svelte';
    import ChatActions from './ChatActions.svelte';

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
        sessions = await fetch_sessions();
        loading_sessions = false;
    }

    async function select_session(session: ChatSession) {
        active_session = { ...session, messages: [] };
        selected_model = session.model;
        sessionStorage.setItem('active_chat_session', session.id);
        loading_messages = true;
        messages = [];
        mobile_sessions_open = false;
        const detail = await fetch_session_detail(session.id);
        if (detail) {
            active_session = detail;
            messages = detail.messages;
        }
        loading_messages = false;
    }

    async function create_session() {
        const session = await create_new_session(selected_model);
        if (!session) return;
        sessions = [session, ...sessions];
        await select_session(session);
    }

    async function delete_session(session_id: string, event: MouseEvent) {
        event.stopPropagation();
        if (!confirm('Delete this session?')) return;
        if (!await remove_session(session_id)) return;
        sessions = sessions.filter((s) => s.id !== session_id);
        if (active_session?.id === session_id) {
            active_session = null;
            messages = [];
            sessionStorage.removeItem('active_chat_session');
        }
    }

    async function rename_session(session_id: string, title: string) {
        const updated = await update_session_title(session_id, title);
        if (!updated) return;
        sessions = sessions.map((s) => s.id === session_id ? { ...s, title: updated.title } : s);
        if (active_session?.id === session_id) {
            active_session = { ...active_session, title: updated.title };
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
        const user_message = build_message(session_id, 'user', message_content);
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
                messages = [...messages, build_message(session_id, 'assistant', streaming_content)];
            }
            streaming_content = '';
            is_streaming = false;
            load_sessions();
        }
        catch {
            if (streaming_content) {
                messages = [...messages, build_message(session_id, 'assistant', streaming_content + '\n\n*(response interrupted)*')];
                streaming_content = '';
            }
            else {
                messages = messages.filter((m) => m.id !== user_message.id);
            }
            error_msg = 'Failed to send message';
            is_streaming = false;
        }
    }

    async function stop_generating() {
        if (!active_session || !is_streaming) return;
        await cancel_chat_stream(active_session.id);
        if (streaming_content) {
            messages = [...messages, build_message(active_session.id, 'assistant', streaming_content + '\n\n*(generation stopped)*')];
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
        bind:input_text bind:selected_model {error_msg} models={chat_models}
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

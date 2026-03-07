<script lang="ts">
    import { ErrorBanner } from '$lib/components';
    import { Button } from '$lib/components/primitives/button';
    import { Select } from '$lib/components/primitives/select';
    import type { ChatMessage, ChatSession, ChatSessionFull } from '$lib/types';
    import MessageThread from './MessageThread.svelte';
    import ChatInput from './ChatInput.svelte';

    interface ModelGroup {
        group: string
        models: string[]
    }

    let {
        session: active_session,
        messages,
        loading_messages,
        is_streaming,
        streaming_content,
        input_text = $bindable(''),
        selected_model = $bindable(''),
        error_msg,
        models,
        format_session_title,
        on_send,
        on_stop,
        on_create
    }: {
        session?: ChatSessionFull | null
        messages: ChatMessage[]
        loading_messages: boolean
        is_streaming: boolean
        streaming_content: string
        input_text: string
        selected_model: string
        error_msg: string
        models: ModelGroup[]
        format_session_title: (session: ChatSession) => string
        on_send: () => void
        on_stop: () => void
        on_create: () => void
    } = $props();
</script>

<div class="chat-area">
    {#if !active_session}
        <div class="empty-chat">
            <span class="icon large-icon">chat</span>
            <p>Select a session or create a new one</p>
            <Button variant="primary" onclick={on_create}>
                <span class="icon">add</span> New Chat
            </Button>
        </div>
    {:else}
        <div class="chat-header">
            <span class="chat-session-title">{format_session_title(active_session)}</span>
            <Select class="model-select" bind:value={selected_model}>
                {#each models as group (group.group)}
                    <optgroup label={group.group}>
                        {#each group.models as model (model)}
                            <option value={model}>{model}</option>
                        {/each}
                    </optgroup>
                {/each}
            </Select>
        </div>

        <MessageThread {messages} {loading_messages} {is_streaming} {streaming_content} />

        {#if error_msg}
            <ErrorBanner message={error_msg} />
        {/if}

        <ChatInput bind:input_text {is_streaming} onsend={on_send} onstop={on_stop} />
    {/if}
</div>

<style>
    .chat-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .empty-chat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        color: var(--fg-muted);
    }

    .large-icon {
        font-size: 48px;
        color: var(--accent);
    }

    .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }

    .chat-session-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg);
    }
</style>

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

    const starter_prompts = [
        { icon: 'lightbulb', text: 'Help me design a new feature' },
        { icon: 'architecture', text: 'Explain the current project architecture' },
        { icon: 'bug_report', text: 'Write tests for the auth module' },
    ];

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
        on_create,
        on_rename
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
        on_rename: (session_id: string, title: string) => Promise<void>
    } = $props();

    let editing_title = $state(false);
    let edit_title_value = $state('');
    let title_input = $state<HTMLInputElement | null>(null);

    function start_edit_title() {
        if (!active_session) return;
        edit_title_value = format_session_title(active_session);
        editing_title = true;
        setTimeout(() => title_input?.select(), 10);
    }

    async function save_title() {
        if (!active_session || !edit_title_value.trim()) {
            editing_title = false;
            return;
        }
        const trimmed = edit_title_value.trim();
        if (trimmed !== format_session_title(active_session)) {
            await on_rename(active_session.id, trimmed);
        }
        editing_title = false;
    }

    function handle_title_keydown(event: KeyboardEvent) {
        if (event.key === 'Enter') save_title();
        if (event.key === 'Escape') editing_title = false;
    }

    let show_starters = $derived(!active_session || (active_session && messages.length === 0 && !loading_messages));

    function use_starter(prompt_text: string) {
        if (!active_session) {
            input_text = prompt_text;
            on_create();
        } else {
            input_text = prompt_text;
            on_send();
        }
    }
</script>

<div class="chat-area">
    {#if !active_session}
        <div class="empty-chat">
            <span class="icon large-icon">chat</span>
            <p>Select a session or create a new one</p>
            <Button variant="primary" onclick={on_create}>
                <span class="icon">add</span> New Chat
            </Button>
            <div class="starter-prompts">
                {#each starter_prompts as prompt (prompt.text)}
                    <button class="starter-btn" onclick={() => use_starter(prompt.text)}>
                        <span class="icon" style="font-size: 18px">{prompt.icon}</span>
                        <span>{prompt.text}</span>
                    </button>
                {/each}
            </div>
        </div>
    {:else}
        <div class="chat-header">
            {#if editing_title}
                <input
                    class="title-edit"
                    bind:this={title_input}
                    bind:value={edit_title_value}
                    onkeydown={handle_title_keydown}
                    onblur={save_title}
                />
            {:else}
                <span class="chat-session-title" ondblclick={start_edit_title} role="button" tabindex="0">
                    {format_session_title(active_session)}
                    <button class="edit-title-btn" onclick={start_edit_title} aria-label="Edit title">
                        <span class="icon" style="font-size: 14px">edit</span>
                    </button>
                </span>
            {/if}
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

        {#if show_starters && messages.length === 0 && !loading_messages}
            <div class="starters-inline">
                <p class="starters-label">Try a prompt to get started:</p>
                <div class="starter-prompts">
                    {#each starter_prompts as prompt (prompt.text)}
                        <button class="starter-btn" onclick={() => use_starter(prompt.text)}>
                            <span class="icon" style="font-size: 18px">{prompt.icon}</span>
                            <span>{prompt.text}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

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
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .edit-title-btn {
        background: none;
        border: none;
        color: var(--fg-muted);
        cursor: pointer;
        padding: 2px;
        opacity: 0;
        transition: opacity 150ms;
        line-height: 1;
        display: flex;
        align-items: center;
    }
    .chat-session-title:hover .edit-title-btn { opacity: 1; }

    .title-edit {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg);
        background: var(--bg);
        border: 1px solid var(--accent);
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        outline: none;
        font-family: var(--font);
        min-width: 180px;
    }

    .starter-prompts {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
        width: 100%;
        max-width: 340px;
    }

    .starter-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        padding: 0.6rem 0.85rem;
        cursor: pointer;
        font-size: 0.8rem;
        font-family: var(--font);
        text-align: left;
        transition: background 150ms, border-color 150ms;
    }
    .starter-btn:hover {
        background: var(--accent-dim);
        border-color: var(--accent);
    }
    .starter-btn .icon { color: var(--accent); }

    .starters-inline {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem 1rem 0;
    }
    .starters-label {
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-bottom: 0.25rem;
    }
</style>

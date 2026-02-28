<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import { read_sse_stream } from '$lib/utils/sse';
  import type { ChatMessage, ChatSession } from '$lib/types';
  import SessionList from './SessionList.svelte';
  import MessageThread from './MessageThread.svelte';
  import ChatInput from './ChatInput.svelte';

  const MODELS = [
    { group: 'Claude', models: [
      'claude-sonnet-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5',
      'claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5', 'claude-sonnet-4',
    ]},
    { group: 'Gemini', models: ['gemini-3-pro-preview'] },
    { group: 'GPT', models: [
      'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2',
      'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5.1', 'gpt-5.1-codex-mini',
      'gpt-5-mini', 'gpt-4.1',
    ]},
  ];

  let sessions = $state<ChatSession[]>([]);
  let active_session = $state<ChatSession | null>(null);
  let messages = $state<ChatMessage[]>([]);
  let input_text = $state('');
  let selected_model = $state('claude-sonnet-4.5');
  let is_streaming = $state(false);
  let streaming_content = $state('');
  let loading_sessions = $state(true);
  let loading_messages = $state(false);
  let error_msg = $state('');

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
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
      toast_store.error('Failed to load chat sessions');
    } finally {
      loading_sessions = false;
    }
  }

  async function select_session(session: ChatSession) {
    active_session = session;
    selected_model = session.model;
    sessionStorage.setItem('active_chat_session', session.id);
    loading_messages = true;
    messages = [];
    try {
      const data = await api.get_chat_session(session.id);
      messages = data.messages ?? [];
    } catch (err) {
      console.error('Failed to load messages:', err);
      error_msg = 'Failed to load messages';
      toast_store.error('Failed to load messages');
    } finally {
      loading_messages = false;
    }
  }

  async function create_session() {
    try {
      const session = await api.create_chat_session({ model: selected_model });
      sessions = [session, ...sessions];
      await select_session(session);
    } catch (err) {
      console.error('Failed to create session:', err);
      error_msg = 'Failed to create session';
      toast_store.error('Failed to create session');
    }
  }

  async function delete_session(session_id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Delete this session?')) return;
    try {
      await api.delete_chat_session(session_id);
      sessions = sessions.filter((session) => session.id !== session_id);
      if (active_session?.id === session_id) {
        active_session = null;
        messages = [];
        sessionStorage.removeItem('active_chat_session');
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      error_msg = 'Failed to delete session';
      toast_store.error('Failed to delete session');
    }
  }

  async function send_message() {
    if (!input_text.trim() || !active_session || is_streaming) return;

    const message_content = input_text.trim();
    input_text = '';
    error_msg = '';
    is_streaming = true;
    streaming_content = '';

    const user_message: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: active_session.id,
      role: 'user',
      content: message_content,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, user_message];

    try {
      const response = await api.send_chat_message(active_session.id, message_content, selected_model);

      await read_sse_stream(response, {
        on_chunk: (chunk) => {
          streaming_content += chunk;
        },
        on_error: (err) => {
          error_msg = err;
        },
      });

      if (streaming_content) {
        const assistant_message: ChatMessage = {
          id: crypto.randomUUID(),
          session_id: active_session!.id,
          role: 'assistant',
          content: streaming_content,
          created_at: new Date().toISOString(),
        };
        messages = [...messages, assistant_message];
      }
      streaming_content = '';
      is_streaming = false;
      load_sessions();
    } catch (send_error) {
      error_msg = 'Failed to send message';
      is_streaming = false;
      messages = messages.filter((message) => message.id !== user_message.id);
    }
  }

  function format_session_title(session: ChatSession) {
    return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
  }
</script>

<div class="chat-page">
  <SessionList
    {sessions}
    {active_session}
    {loading_sessions}
    onselect={select_session}
    ondelete={delete_session}
    oncreate={create_session}
  />

  <div class="chat-area">
    {#if !active_session}
      <div class="empty-chat">
        <span class="icon large-icon">chat</span>
        <p>Select a session or create a new one</p>
        <button class="btn-primary" onclick={create_session}>
          <span class="icon">add</span> New Chat
        </button>
      </div>
    {:else}
      <div class="chat-header">
        <span class="chat-session-title">{format_session_title(active_session)}</span>
        <select class="model-select" bind:value={selected_model}>
          {#each MODELS as group}
            <optgroup label={group.group}>
              {#each group.models as model}
                <option value={model}>{model}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </div>

      <MessageThread
        {messages}
        {loading_messages}
        {is_streaming}
        {streaming_content}
      />

      {#if error_msg}
        <p class="error-banner">{error_msg}</p>
      {/if}

      <ChatInput
        bind:input_text
        {is_streaming}
        onsend={send_message}
      />
    {/if}
  </div>
</div>

<style>
  .chat-page {
    display: flex;
    height: calc(100vh - 4rem);
    gap: 0;
    background: var(--bg);
  }

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

  .model-select {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font-family: var(--font);
  }

  .error-banner {
    background: rgba(201, 84, 74, 0.15);
    border-top: 1px solid var(--danger);
    color: var(--danger);
    font-size: 0.8rem;
    padding: 0.5rem 1rem;
    flex-shrink: 0;
  }

  :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: opacity 0.15s;
  }

  @media (max-width: 768px) {
    .chat-page {
      flex-direction: column;
      height: calc(100dvh - 3.5rem);
      min-height: 0;
    }
    .chat-area { flex: 1; min-height: 0; }
  }
</style>

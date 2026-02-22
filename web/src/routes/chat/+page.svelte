<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { read_sse_stream } from '$lib/utils/sse';
  import type { ChatMessage, ChatSession } from '$lib/types';

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

  let messages_container = $state<HTMLElement | null>(null);

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
    } finally {
      loading_messages = false;
      scroll_to_bottom();
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
    }
  }

  async function send_message() {
    if (!input_text.trim() || !active_session || is_streaming) return;

    const message_content = input_text.trim();
    input_text = '';
    error_msg = '';
    is_streaming = true;
    streaming_content = '';

    // Add user message immediately
    const user_message: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: active_session.id,
      role: 'user',
      content: message_content,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, user_message];
    scroll_to_bottom();

    try {
      // Send message and get the SSE stream response
      const response = await api.send_chat_message(active_session.id, message_content, selected_model);

      await read_sse_stream(response, {
        on_chunk: (chunk) => {
          streaming_content += chunk;
          scroll_to_bottom();
        },
        on_error: (err) => {
          error_msg = err;
        },
      });

      // Finalize: add the complete assistant message
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
      scroll_to_bottom();
      load_sessions();
    } catch (send_error) {
      error_msg = 'Failed to send message';
      is_streaming = false;
      // Remove the optimistic user message
      messages = messages.filter((message) => message.id !== user_message.id);
    }
  }

  function scroll_to_bottom() {
    setTimeout(() => {
      if (messages_container) {
        messages_container.scrollTop = messages_container.scrollHeight;
      }
    }, 50);
  }

  function handle_key_down(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send_message();
    }
  }

  function format_session_title(session: ChatSession) {
    return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
  }
</script>

<div class="chat-page">
  <!-- Session sidebar -->
  <aside class="sessions-panel">
    <div class="sessions-header">
      <span class="sessions-title">Sessions</span>
      <button class="btn-new" onclick={create_session} title="New chat">
        <span class="icon">add</span>
      </button>
    </div>

    {#if loading_sessions}
      <p class="muted-sm">Loading...</p>
    {:else if sessions.length === 0}
      <p class="muted-sm">No sessions yet.</p>
    {:else}
      <ul class="session-list">
        {#each sessions as session (session.id)}
          <li>
            <div
              class="session-item"
              class:active={active_session?.id === session.id}
              role="button"
              tabindex="0"
              onclick={() => select_session(session)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select_session(session); } }}
            >
              <span class="session-label">{format_session_title(session)}</span>
              <button
                class="btn-delete"
                onclick={(event) => delete_session(session.id, event)}
                title="Delete session"
              >
                <span class="icon">close</span>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>

  <!-- Chat area -->
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

      <div class="messages" bind:this={messages_container}>
        {#if loading_messages}
          <p class="muted-sm center">Loading messages...</p>
        {:else if messages.length === 0}
          <p class="muted-sm center">No messages yet. Say something!</p>
        {:else}
          {#each messages as message (message.id)}
            <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
              <div class="message-bubble">
                <p class="message-content">{message.content}</p>
              </div>
            </div>
          {/each}

          {#if is_streaming}
            <div class="message assistant">
              <div class="message-bubble streaming">
                <p class="message-content">{streaming_content || '...'}</p>
                <span class="cursor">▋</span>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      {#if error_msg}
        <p class="error-banner">{error_msg}</p>
      {/if}

      <div class="input-area">
        <textarea
          class="message-input"
          bind:value={input_text}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          disabled={is_streaming}
          onkeydown={handle_key_down}
          rows={3}
        ></textarea>
        <button
          class="btn-send"
          onclick={send_message}
          disabled={!input_text.trim() || is_streaming}
        >
          {#if is_streaming}
            <span class="icon spin">progress_activity</span>
          {:else}
            <span class="icon">send</span>
          {/if}
        </button>
      </div>
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

  /* Sessions sidebar */
  .sessions-panel {
    width: 240px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin-right: 1rem;
  }

  .sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .sessions-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--fg);
  }

  .btn-new {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    border-radius: 50%;
    color: var(--accent);
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-new:hover { background: var(--accent); color: var(--bg); }
  .btn-new .icon { font-size: 16px; }

  .session-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem;
  }

  .session-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s;
    background: none;
    border: 1px solid transparent;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    width: 100%;
    text-align: left;
  }

  .session-item:hover { background: var(--bg-elevated); }
  .session-item.active { background: var(--accent-dim); border: 1px solid var(--accent); }

  .session-label {
    flex: 1;
    font-size: 0.8rem;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-delete {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .session-item:hover .btn-delete,
  .session-item.active .btn-delete { opacity: 1; }
  .btn-delete:hover { color: var(--danger); }
  .btn-delete .icon { font-size: 14px; }

  .muted-sm {
    font-size: 0.8rem;
    color: var(--fg-muted);
    padding: 1rem;
  }

  /* Chat area */
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

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .center { text-align: center; margin: auto; }

  .message {
    display: flex;
  }

  .message.user { justify-content: flex-end; }
  .message.assistant { justify-content: flex-start; }

  .message-bubble {
    max-width: 75%;
    padding: 0.65rem 1rem;
    border-radius: var(--radius);
  }

  .message.user .message-bubble {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
  }

  .message.assistant .message-bubble {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }

  .message-bubble.streaming {
    background: var(--bg-elevated);
    border: 1px solid var(--accent);
  }

  .message-content {
    font-size: 0.875rem;
    color: var(--fg);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }

  .cursor {
    animation: blink 1s step-end infinite;
    color: var(--accent);
  }

  @keyframes blink { 50% { opacity: 0; } }

  .error-banner {
    background: rgba(201, 84, 74, 0.15);
    border-top: 1px solid var(--danger);
    color: var(--danger);
    font-size: 0.8rem;
    padding: 0.5rem 1rem;
    flex-shrink: 0;
  }

  .input-area {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .message-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.875rem;
    padding: 0.6rem 0.85rem;
    font-family: var(--font);
    resize: none;
    transition: border-color 0.15s;
  }

  .message-input:focus { outline: none; border-color: var(--accent); }
  .message-input:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-send {
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: var(--bg);
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.15s;
    align-self: flex-end;
    height: 44px;
    flex-shrink: 0;
  }

  .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-send:not(:disabled):hover { opacity: 0.9; }

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

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .chat-page {
      flex-direction: column;
      height: calc(100dvh - 3.5rem);
      min-height: 0;
    }
    .sessions-panel { width: 100%; height: 180px; margin-right: 0; margin-bottom: 0; }
    .chat-area { flex: 1; min-height: 0; }
    .message-bubble { max-width: 90%; }
    .input-area { padding-bottom: env(safe-area-inset-bottom, 0.75rem); }
  }
</style>

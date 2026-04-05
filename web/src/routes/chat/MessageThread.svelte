<script lang="ts">
  import { EmptyState, LoadingSpinner } from '$lib/components';
  import type { ChatMessage } from '$lib/types';
  import { copy_to_clipboard } from '$lib/utils/clipboard';
  import { init_code_copy_handlers } from '$lib/utils/markdown';
  import MessageContent from './MessageContent.svelte';

  let {
      messages,
      loading_messages,
      is_streaming,
      streaming_content
  }: {
      messages: ChatMessage[]
      loading_messages: boolean
      is_streaming: boolean
      streaming_content: string
  } = $props();

  let messages_container = $state<HTMLElement | null>(null);
  let show_scroll_btn = $state(false);

  function scroll_to_bottom() {
      setTimeout(() => {
          if (messages_container) {
              messages_container.scrollTop = messages_container.scrollHeight;
          }
      }, 50);
  }

  function handle_scroll() {
      if (!messages_container) return;
      const { scrollTop: scroll_top, scrollHeight: scroll_height, clientHeight: client_height } = messages_container;
      show_scroll_btn = scroll_height - scroll_top - client_height > 100;
  }

  function copy_message(content: string) {
      copy_to_clipboard(content, 'Message copied');
  }

  $effect(() => {
      void messages;
      void streaming_content;
      const id = setTimeout(() => {
          if (messages_container) {
              messages_container.scrollTop = messages_container.scrollHeight;
          }
      }, 50);
      return () => clearTimeout(id);
  });

  // Re-bind code copy handlers when messages change
  $effect(() => {
      void messages;
      void is_streaming;
      const id = setTimeout(() => {
          if (messages_container) {
              init_code_copy_handlers(messages_container);
          }
      }, 100);
      return () => clearTimeout(id);
  });
</script>

<div class="messages-wrapper">
  <div class="messages" bind:this={messages_container} onscroll={handle_scroll}>
    {#if loading_messages}
      <div class="thread-center">
        <LoadingSpinner size="sm" label="Loading messages..." />
      </div>
    {:else if messages.length === 0}
      <div class="thread-center">
        <EmptyState icon="chat" message="No messages yet. Say something!" />
      </div>
    {:else}
      {#each messages as message (message.id)}
        <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
          <div class="message-bubble">
            <MessageContent content={message.content} role={message.role} />
            <button class="msg-copy-btn" onclick={() => copy_message(message.content)} title="Copy message" aria-label="Copy message">
              <span class="icon" style="font-size: 14px">content_copy</span>
            </button>
          </div>
        </div>
      {/each}

      {#if is_streaming}
        <div class="message assistant" role="status" aria-live="polite">
          <div class="message-bubble streaming">
            {#if streaming_content}
              <MessageContent content={streaming_content} role="assistant" />
            {:else}
              <p class="streaming-placeholder">...</p>
            {/if}
            <span class="cursor">▋</span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if show_scroll_btn}
    <button class="scroll-to-bottom-btn" onclick={scroll_to_bottom} aria-label="Scroll to bottom">
      <span class="icon" style="font-size: 18px">keyboard_arrow_down</span>
    </button>
  {/if}
</div>

<style>
  .messages-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .thread-center {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
  }

  .message {
    display: flex;
  }

  .message.user { justify-content: flex-end; }
  .message.assistant { justify-content: flex-start; }

  .message-bubble {
    max-width: 75%;
    padding: 0.65rem 1rem;
    border-radius: var(--radius);
    position: relative;
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

  .streaming-placeholder {
    font-size: 0.875rem;
    color: var(--fg);
    margin: 0;
  }

  .msg-copy-btn {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
    opacity: 0;
    transition: opacity 150ms;
    line-height: 1;
  }
  .message-bubble:hover .msg-copy-btn { opacity: 1; }

  .cursor {
    animation: blink 1s step-end infinite;
    color: var(--accent);
  }

  .scroll-to-bottom-btn {
    position: absolute;
    bottom: 0.75rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--fg-muted);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: background 150ms, color 150ms;
    z-index: 10;
  }
  .scroll-to-bottom-btn:hover {
    background: var(--bg-surface);
    color: var(--fg);
  }

  @keyframes blink { 50% { opacity: 0; } }

  @media (max-width: 768px) {
    .message-bubble { max-width: 90%; }
  }
</style>

<script lang="ts">
  import { EmptyState, LoadingSpinner } from '$lib/components';
  import type { ChatMessage } from '$lib/types';

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

  function scroll_to_bottom() {
      setTimeout(() => {
          if (messages_container) {
              messages_container.scrollTop = messages_container.scrollHeight;
          }
      }, 50);
  }

  $effect(() => {
      // Re-run whenever messages array or streaming content changes
      void messages;
      void streaming_content;
      scroll_to_bottom();
  });
</script>

<div class="messages" bind:this={messages_container}>
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
          <p class="message-content">{message.content}</p>
        </div>
      </div>
    {/each}

    {#if is_streaming}
      <div class="message assistant" role="status" aria-live="polite">
        <div class="message-bubble streaming">
          <p class="message-content">{streaming_content || '...'}</p>
          <span class="cursor">▋</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
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

  @media (max-width: 768px) {
    .message-bubble { max-width: 90%; }
  }
</style>

<script lang="ts">
  import '$lib/styles/hljs-dark.css';
  import { EmptyState, LoadingSpinner } from '$lib/components';
  import type { ChatMessage } from '$lib/types';
  import { copy_to_clipboard } from '$lib/utils/clipboard';
  import { init_code_copy_handlers, render_markdown } from '$lib/utils/markdown';

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
      const { scrollTop, scrollHeight, clientHeight } = messages_container;
      show_scroll_btn = scrollHeight - scrollTop - clientHeight > 100;
  }

  function copy_message(content: string) {
      copy_to_clipboard(content, 'Message copied');
  }

  $effect(() => {
      void messages;
      void streaming_content;
      scroll_to_bottom();
  });

  // Re-bind code copy handlers when messages change
  $effect(() => {
      void messages;
      void is_streaming;
      setTimeout(() => {
          if (messages_container) {
              init_code_copy_handlers(messages_container);
          }
      }, 100);
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
            {#if message.role === 'assistant'}
              <div class="message-content markdown-body">{@html render_markdown(message.content)}</div>
            {:else}
              <p class="message-content">{message.content}</p>
            {/if}
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
              <div class="message-content markdown-body">{@html render_markdown(streaming_content)}</div>
            {:else}
              <p class="message-content">...</p>
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

  .message-content {
    font-size: 0.875rem;
    color: var(--fg);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }

  /* Markdown body overrides pre-wrap for rendered HTML */
  .markdown-body {
    white-space: normal;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) {
    color: var(--fg);
    margin: 0.75rem 0 0.35rem;
    font-size: 1rem;
  }
  .markdown-body :global(h1) { font-size: 1.1rem; }
  .markdown-body :global(p) { margin: 0.25rem 0; }
  .markdown-body :global(code) {
    background: var(--bg);
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  .markdown-body :global(pre) {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  .markdown-body :global(pre code) {
    background: none;
    padding: 0;
    white-space: pre;
  }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.25rem;
    margin: 0.35rem 0;
  }
  .markdown-body :global(a) {
    color: var(--accent);
  }
  .markdown-body :global(blockquote) {
    border-left: 3px solid var(--border);
    padding-left: 0.75rem;
    color: var(--fg-muted);
    margin: 0.5rem 0;
  }
  .markdown-body :global(.code-block-wrapper) {
    position: relative;
  }
  .markdown-body :global(.copy-code-btn) {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-muted);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms;
  }
  .markdown-body :global(.code-block-wrapper:hover .copy-code-btn) {
    opacity: 1;
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

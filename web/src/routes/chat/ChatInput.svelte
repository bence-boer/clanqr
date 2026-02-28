<script lang="ts">
  let {
    input_text = $bindable(''),
    is_streaming,
    onsend,
    onstop,
  }: {
    input_text: string;
    is_streaming: boolean;
    onsend: () => void;
    onstop?: () => void;
  } = $props();

  function handle_key_down(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onsend();
    }
  }
</script>

<div class="input-area">
  <textarea
    class="message-input"
    bind:value={input_text}
    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
    disabled={is_streaming}
    onkeydown={handle_key_down}
    rows={3}
  ></textarea>
  {#if is_streaming && onstop}
    <button class="btn-stop" onclick={onstop} title="Stop generating">
      <span class="icon">stop</span>
    </button>
  {:else}
    <button
      class="btn-send"
      onclick={onsend}
      disabled={!input_text.trim() || is_streaming}
    >
      {#if is_streaming}
        <span class="icon spin">progress_activity</span>
      {:else}
        <span class="icon">send</span>
      {/if}
    </button>
  {/if}
</div>

<style>
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

  .btn-stop {
    background: var(--danger);
    border: none;
    border-radius: var(--radius);
    color: #fff;
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
  .btn-stop:hover { opacity: 0.9; }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .input-area { padding-bottom: env(safe-area-inset-bottom, 0.75rem); }
  }
</style>

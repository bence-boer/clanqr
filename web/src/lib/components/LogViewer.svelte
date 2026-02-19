<script lang="ts">
  interface Props {
    log: string;
    max_height?: string;
  }

  const { log, max_height = '400px' }: Props = $props();

  let container = $state<HTMLElement>();

  $effect(() => {
    if (log && container) {
      container.scrollTop = container.scrollHeight;
    }
  });
</script>

<div
  class="log-viewer"
  style="max-height: {max_height}"
  bind:this={container}
>
  {#if log}
    <pre>{log}</pre>
  {:else}
    <span class="log-empty">No output yet.</span>
  {/if}
</div>

<style>
  .log-viewer {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    overflow-y: auto;
    font-family: monospace;
  }

  pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text);
  }

  .log-empty {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

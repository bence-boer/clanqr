<script lang="ts">
  import { toast_store } from "$lib/stores/toast.svelte";

  const icon_map: Record<string, string> = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };
</script>

{#if toast_store.items.length > 0}
  <div class="toast-container" aria-live="polite">
    {#each toast_store.items as toast (toast.id)}
      <div class="toast toast-{toast.type}" role="alert">
        <span class="icon" style="font-size:16px">{icon_map[toast.type]}</span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" onclick={() => toast_store.dismiss(toast.id)} aria-label="Dismiss">
          <span class="icon" style="font-size:14px">close</span>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 400px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius);
    font-size: 0.85rem;
    color: var(--fg);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: toast-in 0.2s ease;
  }

  .toast-success { border-left: 3px solid var(--success); }
  .toast-error { border-left: 3px solid var(--danger); }
  .toast-warning { border-left: 3px solid var(--accent); }
  .toast-info { border-left: 3px solid var(--fg-muted); }

  .toast-success .icon:first-child { color: var(--success); }
  .toast-error .icon:first-child { color: var(--danger); }
  .toast-warning .icon:first-child { color: var(--accent); }
  .toast-info .icon:first-child { color: var(--fg-muted); }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 0.15rem;
    border-radius: var(--radius);
    line-height: 1;
    display: inline-flex;
  }

  .toast-close:hover {
    color: var(--fg);
    background: var(--bg-elevated);
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(1rem); }
    to { opacity: 1; transform: translateX(0); }
  }

  @media (max-width: 768px) {
    .toast-container {
      left: 1rem;
      right: 1rem;
      max-width: none;
    }
  }
</style>

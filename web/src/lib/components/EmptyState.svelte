<script lang="ts">
  interface Props {
      icon?: string
      message: string
      detail?: string
  }

  const { icon = 'inbox', message, detail }: Props = $props();
</script>

<div class="empty-state">
  <span class="icon empty-icon">{icon}</span>
  <p class="empty-message">{message}</p>
  {#if detail}
    <p class="empty-detail">{detail}</p>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--fg-muted);
    gap: 8px;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.4;
  }

  .empty-message {
    font-size: 15px;
    font-weight: 500;
    color: var(--fg-muted);
    margin: 0;
  }

  .empty-detail {
    font-size: 13px;
    color: var(--fg-muted);
    opacity: 0.7;
    margin: 0;
  }
</style>

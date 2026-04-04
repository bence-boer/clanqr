<script lang="ts">
    import { resolve } from '$app/paths';
    import type { Pathname } from '$app/types';
    import { Button } from '$lib/components/primitives';
    import type { Snippet } from 'svelte';

    interface Props {
        icon?: string
        message: string
        detail?: string
        action_label?: string
        action_href?: string
        onaction?: () => void
        children?: Snippet
    }

    const { icon = 'inbox', message, detail, action_label, action_href, onaction, children }: Props = $props();
</script>

<div data-slot="empty-state" class="empty-state">
    <span class="icon empty-icon">{icon}</span>
    <p class="empty-message">{message}</p>
    {#if detail}
        <p class="empty-detail">{detail}</p>
    {/if}
    {#if children}
        <div class="empty-actions">
            {@render children()}
        </div>
    {:else if action_label}
        <div class="empty-actions">
            {#if action_href}
                <a href={resolve(action_href as Pathname)} class="empty-link">{action_label}</a>
            {:else if onaction}
                <Button variant="primary" size="sm" onclick={onaction}>{action_label}</Button>
            {/if}
        </div>
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

  .empty-actions {
    margin-top: 0.75rem;
  }

  .empty-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .empty-link:hover {
    text-decoration: underline;
  }
</style>

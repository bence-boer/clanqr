<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    subtitle?: string;
    actions?: Snippet;
  }

  let { title, subtitle, actions }: Props = $props();
</script>

<div class="page-header">
  <div>
    <h2>{title}</h2>
    {#if subtitle}
      <p class="page-subtitle">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    <div class="page-header-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .page-subtitle {
    color: var(--fg-muted);
    font-size: 0.875rem;
    margin-top: 0.2rem;
  }

  .page-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>

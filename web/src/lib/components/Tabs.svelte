<script lang="ts">
  interface TabItem {
    value: string;
    label: string;
    icon?: string;
    count?: number;
  }

  interface Props {
    tabs: TabItem[];
    active: string;
    on_change: (value: string) => void;
  }

  let { tabs, active, on_change }: Props = $props();
</script>

<div class="tabs" role="tablist">
  {#each tabs as tab (tab.value)}
    <button
      class="tab-btn"
      class:active={active === tab.value}
      role="tab"
      aria-selected={active === tab.value}
      onclick={() => on_change(tab.value)}
    >
      {#if tab.icon}
        <span class="icon">{tab.icon}</span>
      {/if}
      {tab.label}
      {#if tab.count !== undefined && tab.count > 0}
        <span class="count-badge">{tab.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1.1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: var(--fg);
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .count-badge {
    background: var(--bg-elevated);
    color: var(--fg-muted);
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-weight: 600;
  }
</style>

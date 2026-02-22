<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    columns: string[];
    children: Snippet;
  }

  let { columns, children }: Props = $props();
</script>

<div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        {#each columns as col}
          <th>{col}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {@render children()}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table :global(thead th) {
    background: var(--bg-surface);
    color: var(--fg-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .data-table :global(tbody tr) {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }

  .data-table :global(tbody tr:last-child) {
    border-bottom: none;
  }

  .data-table :global(tbody tr:hover) {
    background: var(--bg-surface);
  }

  .data-table :global(td) {
    padding: 0.75rem 1rem;
    color: var(--fg);
    vertical-align: middle;
  }
</style>

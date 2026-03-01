<script lang="ts">
  import type { UsageBreakdown } from '$lib/types';

  let { breakdown, loading }: {
      breakdown: UsageBreakdown | null
      loading: boolean
  } = $props();

  function bar_pct(value: number, record: Record<string, number>): number {
      const max = Math.max(...Object.values(record), 1);
      return Math.round((value / max) * 100);
  }

  let by_type_entries = $derived(
      breakdown
          ? Object.entries(breakdown.by_type).sort(([, count_a], [, count_b]) => count_b - count_a)
          : []
  );

  let by_model_entries = $derived(
      breakdown
          ? Object.entries(breakdown.by_model).sort(([, count_a], [, count_b]) => count_b - count_a)
          : []
  );
</script>

{#if !loading && breakdown}
  <div class="breakdown-section">
    <div class="breakdown-panel">
      <h3 class="panel-title">Breakdown by Type</h3>
      <div class="bar-list">
        {#each by_type_entries as [type_name, count] (type_name)}
          <div class="bar-row">
            <span class="bar-label">{type_name}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {bar_pct(count, breakdown.by_type)}%"></div>
            </div>
            <span class="bar-count">{count}</span>
          </div>
        {/each}
        {#if by_type_entries.length === 0}
          <p class="no-data">No data yet</p>
        {/if}
      </div>
    </div>
    <div class="breakdown-panel">
      <h3 class="panel-title">Breakdown by Model</h3>
      <div class="bar-list">
        {#each by_model_entries as [model_name, count] (model_name)}
          <div class="bar-row">
            <span class="bar-label">{model_name}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {bar_pct(count, breakdown.by_model)}%"></div>
            </div>
            <span class="bar-count">{count}</span>
          </div>
        {/each}
        {#if by_model_entries.length === 0}
          <p class="no-data">No data yet</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .breakdown-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .breakdown-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
  }

  .panel-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-muted);
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .bar-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .bar-label {
    font-size: 0.8rem;
    color: var(--fg);
    width: 96px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-track {
    flex: 1;
    height: 8px;
    background: var(--bg-elevated);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.3s ease;
    min-width: 3px;
  }

  .bar-count {
    font-size: 0.8rem;
    color: var(--fg-muted);
    width: 36px;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .no-data {
    font-size: 0.8rem;
    color: var(--fg-muted);
    text-align: center;
    padding: 1rem 0;
    margin: 0;
  }

  @media (max-width: 768px) {
    .breakdown-section { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .breakdown-section { grid-template-columns: 1fr; }
    .bar-label { width: auto; min-width: 60px; }
  }
</style>

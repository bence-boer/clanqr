<script lang="ts">
  import type { UsageBreakdown } from '$lib/types';

  type BreakdownWithTokens = UsageBreakdown & {
      total_prompt_tokens?: number
      total_completion_tokens?: number
  };

  let { breakdown, loading }: {
      breakdown: BreakdownWithTokens | null
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
  {#if breakdown.total_prompt_tokens !== undefined || breakdown.total_completion_tokens !== undefined}
    <div class="tokens-summary">
      <h3 class="panel-title">Total Tokens</h3>
      <div class="tokens-grid">
        <div class="token-stat">
          <span class="token-value">{(breakdown.total_prompt_tokens ?? 0).toLocaleString()}</span>
          <span class="token-label">Prompt</span>
        </div>
        <div class="token-stat">
          <span class="token-value">{(breakdown.total_completion_tokens ?? 0).toLocaleString()}</span>
          <span class="token-label">Completion</span>
        </div>
        <div class="token-stat token-total">
          <span class="token-value">{((breakdown.total_prompt_tokens ?? 0) + (breakdown.total_completion_tokens ?? 0)).toLocaleString()}</span>
          <span class="token-label">Total</span>
        </div>
      </div>
    </div>
  {/if}
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

  .tokens-summary {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    margin-bottom: 2rem;
  }

  .tokens-grid {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .token-stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .token-stat.token-total {
    margin-left: auto;
  }

  .token-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }

  .token-total .token-value {
    color: var(--accent);
  }

  .token-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-muted);
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .breakdown-section { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .breakdown-section { grid-template-columns: 1fr; }
    .bar-label { width: auto; min-width: 60px; }
  }
</style>

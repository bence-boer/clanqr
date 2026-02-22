<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { EmptyState, LoadingSpinner, StatCard, StatusBadge } from '$lib/components';
  import type { AgentRun, UsageBreakdown, UsageSummary } from '$lib/types';

  let summary = $state<UsageSummary | null>(null);
  let breakdown = $state<UsageBreakdown | null>(null);
  let runs = $state<AgentRun[]>([]);
  let total_pages = $state(1);
  let total_count = $state(0);
  let loading_summary = $state(true);
  let loading_breakdown = $state(true);
  let loading_history = $state(true);
  let filter_type = $state('');
  let filter_status = $state('');
  let current_page = $state(1);

  function format_duration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return '< 1s';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem_secs = secs % 60;
    return rem_secs > 0 ? `${mins}m ${rem_secs}s` : `${mins}m`;
  }

  function format_relative(date_str: string | null): string {
    if (!date_str) return '-';
    const diff_secs = Math.floor((Date.now() - new Date(date_str).getTime()) / 1000);
    if (diff_secs < 60) return `${diff_secs}s ago`;
    if (diff_secs < 3600) return `${Math.floor(diff_secs / 60)}m ago`;
    if (diff_secs < 86400) return `${Math.floor(diff_secs / 3600)}h ago`;
    const days = Math.floor(diff_secs / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function format_tokens(prompt: number | null, completion: number | null): string {
    if (prompt === null && completion === null) return '-';
    return ((prompt ?? 0) + (completion ?? 0)).toLocaleString();
  }

  function bar_pct(value: number, record: Record<string, number>): number {
    const max = Math.max(...Object.values(record), 1);
    return Math.round((value / max) * 100);
  }

  onMount(() => {
    api.usage_summary()
      .then(data => { summary = data; })
      .catch(err => console.error('usage summary error:', err))
      .finally(() => { loading_summary = false; });

    api.usage_breakdown()
      .then(data => { breakdown = data; })
      .catch(err => console.error('usage breakdown error:', err))
      .finally(() => { loading_breakdown = false; });
  });

  $effect(() => {
    const page = current_page;
    const type = filter_type;
    const status = filter_status;

    loading_history = true;
    api.usage_history(page, 20, type || undefined, status || undefined)
      .then(result => {
        runs = result.runs;
        total_pages = result.total_pages;
        total_count = result.total;
      })
      .catch(err => console.error('usage history error:', err))
      .finally(() => { loading_history = false; });
  });

  function on_type_change(event: Event) {
    filter_type = (event.currentTarget as HTMLSelectElement).value;
    current_page = 1;
  }

  function on_status_change(event: Event) {
    filter_status = (event.currentTarget as HTMLSelectElement).value;
    current_page = 1;
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

<div class="page">
  <div class="page-header">
    <h2>Usage Analytics</h2>
  </div>

  {#if loading_summary}
    <div class="loading-row">
      <LoadingSpinner label="Loading stats..." />
    </div>
  {:else if summary}
    <div class="stats-grid stats-3">
      <StatCard icon="bar_chart" value={summary.total_runs} label="Total Runs" />
      <StatCard icon="today" value={summary.today_runs} label="Today" />
      <StatCard icon="date_range" value={summary.week_runs} label="This Week" />
    </div>
    <div class="stats-grid stats-2">
      <StatCard icon="check_circle" value={summary.completed_runs} label="Completed" />
      <StatCard icon="error" value={summary.failed_runs} label="Failed" />
    </div>
  {/if}

  {#if !loading_breakdown && breakdown}
    <div class="breakdown-section">
      <div class="breakdown-panel">
        <h3 class="panel-title">Breakdown by Type</h3>
        <div class="bar-list">
          {#each by_type_entries as [type_name, count]}
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
          {#each by_model_entries as [model_name, count]}
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

  <div class="history-section">
    <div class="history-header">
      <h3>Recent Runs {#if total_count > 0}<span class="count-badge">{total_count}</span>{/if}</h3>
      <div class="filters">
        <select class="select" onchange={on_type_change} value={filter_type}>
          <option value="">All types</option>
          <option value="manager">manager</option>
          <option value="ralph">ralph</option>
          <option value="chat">chat</option>
        </select>
        <select class="select" onchange={on_status_change} value={filter_status}>
          <option value="">All statuses</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="running">running</option>
          <option value="stopped">stopped</option>
          <option value="queued">queued</option>
        </select>
      </div>
    </div>

    {#if loading_history}
      <div class="loading-row">
        <LoadingSpinner label="Loading runs..." />
      </div>
    {:else if runs.length === 0}
      <EmptyState icon="analytics" message="No runs found" detail="Try adjusting your filters." />
    {:else}
      <div class="table-wrap">
        <table class="runs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Model</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Tokens</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {#each runs as run}
              <tr>
                <td><span class="type-badge type-{run.type}">{run.type}</span></td>
                <td class="model-col">{run.model ?? 'default'}</td>
                <td><StatusBadge status={run.status} /></td>
                <td class="mono">{format_duration(run.duration_ms)}</td>
                <td class="mono">{format_tokens(run.prompt_tokens, run.completion_tokens)}</td>
                <td class="date-col">{format_relative(run.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if total_pages > 1}
        <div class="pagination">
          <button
            class="btn"
            disabled={current_page <= 1}
            onclick={() => { current_page -= 1; }}
          >
            <span class="icon">chevron_left</span>
          </button>
          <span class="page-info">Page {current_page} of {total_pages}</span>
          <button
            class="btn"
            disabled={current_page >= total_pages}
            onclick={() => { current_page += 1; }}
          >
            <span class="icon">chevron_right</span>
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 960px;
    overflow-x: hidden;
  }

  .page-header {
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .page-header h2 {
    font-size: 1.5rem;
    color: var(--fg);
  }

  /* ── Stats ─────────────────────────────────────────────────────────────── */
  .stats-grid {
    display: grid;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stats-3 { grid-template-columns: repeat(3, 1fr); }
  .stats-2 { grid-template-columns: repeat(2, 1fr); margin-bottom: 1.5rem; }

  /* ── Breakdown ─────────────────────────────────────────────────────────── */
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

  /* ── History ───────────────────────────────────────────────────────────── */
  .history-section {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.9rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .history-header h3 {
    font-size: 1rem;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .count-badge {
    font-size: 0.7rem;
    background: var(--bg-elevated);
    color: var(--fg-muted);
    padding: 0.15rem 0.45rem;
    border-radius: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
    font-family: inherit;
    min-width: 0;
  }

  .select:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* ── Table ─────────────────────────────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
  }

  .runs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .runs-table thead tr {
    border-bottom: 1px solid var(--border);
  }

  .runs-table th {
    padding: 0.6rem 1.25rem;
    text-align: left;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .runs-table td {
    padding: 0.65rem 1.25rem;
    color: var(--fg);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .runs-table tbody tr:last-child td {
    border-bottom: none;
  }

  .runs-table tbody tr:hover {
    background: var(--bg-elevated);
  }

  .mono {
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
  }

  .runs-table td.date-col {
    color: var(--fg-muted);
    font-size: 0.8rem;
  }

  .runs-table td.model-col {
    font-size: 0.8rem;
    color: var(--fg-muted);
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Type badges ───────────────────────────────────────────────────────── */
  .type-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 10px;
  }

  .type-manager {
    background: rgba(100, 160, 255, 0.15);
    color: #6ea8fe;
  }

  .type-ralph {
    background: rgba(212, 175, 55, 0.15);
    color: var(--accent);
  }

  .type-chat {
    background: rgba(80, 200, 140, 0.15);
    color: var(--success);
  }

  /* ── Pagination ────────────────────────────────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--border);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 0.82rem;
    color: var(--fg-muted);
  }

  /* ── Loading ───────────────────────────────────────────────────────────── */
  .loading-row {
    padding: 2rem 1.25rem;
    display: flex;
    justify-content: center;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .stats-3 { grid-template-columns: repeat(2, 1fr); }
    .breakdown-section { grid-template-columns: 1fr; }
    .filters { flex-wrap: wrap; }
  }

  @media (max-width: 640px) {
    .stats-3 { grid-template-columns: 1fr; }
    .stats-2 { grid-template-columns: 1fr; }
    .breakdown-section { grid-template-columns: 1fr; }
    .history-header { flex-direction: column; align-items: flex-start; }
    .filters { flex-direction: column; width: 100%; }
    .bar-label { width: auto; min-width: 60px; }
  }
</style>

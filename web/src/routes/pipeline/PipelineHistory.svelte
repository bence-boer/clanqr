<script lang="ts">
  import { EmptyState } from '$lib/components';
  import type { AgentRun } from '$lib/types';

  let {
    history,
    history_total,
    history_page,
    history_total_pages,
    filter_status,
    onfilter_change,
    onpage_change,
  }: {
    history: AgentRun[];
    history_total: number;
    history_page: number;
    history_total_pages: number;
    filter_status: string;
    onfilter_change: (status: string) => void;
    onpage_change: (page: number) => void;
  } = $props();

  let expanded_run = $state<string | null>(null);

  function toggle_run_log(id: string) {
    expanded_run = expanded_run === id ? null : id;
  }

  function run_status_icon(status: string) {
    if (status === 'completed') return 'check_circle';
    if (status === 'failed') return 'error';
    if (status === 'running') return 'sync';
    if (status === 'stopped') return 'stop_circle';
    return 'hourglass_empty';
  }

  function run_status_class(status: string) {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'running') return 'warn';
    return 'muted';
  }

  function get_run_ref_label(run: AgentRun): string {
    const ref_id = run.feature_id ?? run.task_id ?? run.session_id;
    if (ref_id) return `${run.type === 'manager' ? 'Feature' : run.type === 'ralph' ? 'Task' : 'Chat'} ${ref_id.slice(0, 8)}…`;
    return run.type;
  }

  function format_ms(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return '< 1s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function format_date(iso: string) {
    return new Date(iso).toLocaleString();
  }
</script>

<section class="section">
  <div class="section-header-row">
    <h3 class="section-title">
      <span class="icon">history</span>
      Run History
      {#if history_total > 0}
        <span class="count-badge">{history_total}</span>
      {/if}
    </h3>
    <div class="history-filters">
      <select
        class="filter-select"
        value={filter_status}
        onchange={(e) => {
          onfilter_change(e.currentTarget.value);
        }}
      >
        <option value="">All statuses</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
        <option value="running">Running</option>
        <option value="stopped">Stopped</option>
      </select>
    </div>
  </div>

  {#if history.length === 0}
    <EmptyState icon="receipt_long" message="No runs yet" />
  {:else}
    <div class="history-list">
      {#each history as run}
        <div class="history-item">
          <div class="history-item-header">
            <div class="history-item-left">
              <span class="icon run-status-icon {run_status_class(run.status)}">{run_status_icon(run.status)}</span>
              <div>
                <p class="run-ref">{get_run_ref_label(run)}</p>
                <p class="run-meta">{format_date(run.created_at)} · {format_ms(run.duration_ms)}</p>
              </div>
            </div>
            <div class="history-item-right">
              <span class="badge badge-{run_status_class(run.status)}">{run.status}</span>
              {#if run.log}
                <button class="btn-icon-sm" onclick={() => toggle_run_log(run.id)} title="View log">
                  <span class="icon">terminal</span>
                </button>
              {/if}
            </div>
          </div>

          {#if expanded_run === run.id && run.log}
            <pre class="log-content log-compact">{run.log}</pre>
          {/if}
          {#if run.error}
            <p class="run-error">{run.error}</p>
          {/if}
        </div>
      {/each}
    </div>

    {#if history_total_pages > 1}
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" disabled={history_page <= 1} onclick={() => onpage_change(history_page - 1)}>
          <span class="icon">chevron_left</span>
        </button>
        <span class="page-info">Page {history_page} of {history_total_pages}</span>
        <button class="btn btn-secondary btn-sm" disabled={history_page >= history_total_pages} onclick={() => onpage_change(history_page + 1)}>
          <span class="icon">chevron_right</span>
        </button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .section { margin-bottom: 2rem; }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .section-header-row .section-title { margin-bottom: 0; }

  .count-badge {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    border-radius: 10px;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }

  .history-filters { display: flex; gap: 0.5rem; }

  .filter-select {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.8rem;
    padding: 0.35rem 0.65rem;
    cursor: pointer;
    font-family: var(--font);
  }

  .history-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .history-item {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
  }

  .history-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .history-item-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .history-item-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .run-status-icon { font-size: 20px; flex-shrink: 0; }
  .run-status-icon.success { color: var(--success); }
  .run-status-icon.danger { color: var(--danger); }
  .run-status-icon.warn { color: var(--accent); }
  .run-status-icon.muted { color: var(--fg-muted); }

  .run-ref { font-size: 0.875rem; color: var(--fg); font-family: monospace; }
  .run-meta { font-size: 0.75rem; color: var(--fg-muted); }
  .run-error { font-size: 0.8rem; color: var(--danger); margin-top: 0.4rem; }

  .log-content {
    background: var(--bg);
    padding: 0.85rem;
    font-size: 0.75rem;
    color: var(--fg-muted);
    font-family: 'SF Mono', 'Fira Code', monospace;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 350px;
    overflow-y: auto;
    margin: 0;
  }

  .log-compact { max-height: 200px; }

  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 0.9rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: opacity 0.15s; white-space: nowrap; font-family: var(--font);
  }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); border: 1px solid var(--border); }
  .btn:hover:not(:disabled) { opacity: 0.85; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.65rem; font-size: 0.78rem; }

  .btn-icon-sm {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg-muted);
    padding: 0.25rem;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: color 0.15s;
  }
  .btn-icon-sm:hover { color: var(--fg); }
  .btn-icon-sm:disabled { opacity: 0.5; cursor: not-allowed; }

  .badge {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    padding: 0.15rem 0.5rem; border-radius: 10px;
  }
  .badge-success { background: rgba(74,158,110,0.15); color: var(--success); }
  .badge-danger { background: rgba(201,84,74,0.15); color: var(--danger); }
  .badge-warn { background: var(--accent-dim); color: var(--accent); }
  .badge-muted { background: var(--bg-elevated); color: var(--fg-muted); }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .page-info { font-size: 0.8rem; color: var(--fg-muted); }

  @media (max-width: 768px) {
    .pagination { flex-wrap: wrap; gap: 0.5rem; }
  }
</style>

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import { StatusBadge, LoadingSpinner, EmptyState } from '$lib/components';
  import { use_polling } from '$lib/utils/polling';
  import type { AgentRun, PipelineStatus, Task } from '$lib/types';

  let pipeline = $state<PipelineStatus | null>(null);
  let queue = $state<Task[]>([]);
  let history = $state<AgentRun[]>([]);
  let history_total = $state(0);
  let history_page = $state(1);
  let history_total_pages = $state(1);
  let filter_status = $state('');

  let loading = $state(true);
  let log_text = $state('');
  let log_visible = $state(false);
  let log_loading = $state(false);

  let action_error = $state('');
  let action_busy = $state(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  async function load_pipeline() {
    try {
      pipeline = await api.pipeline_status();
    } catch (err) {
      console.error('Failed to load pipeline status:', err);
      toast_store.error('Failed to load pipeline status');
    }
  }

  async function load_queue() {
    try {
      queue = await api.list_tasks(undefined, 'Approved');
    } catch (err) {
      console.error('Failed to load queue:', err);
      toast_store.error('Failed to load queue');
      queue = [];
    }
  }

  async function load_history() {
    try {
      const result = await api.usage_history(history_page, 20, 'ralph', filter_status || undefined);
      history = result.runs;
      history_total = result.total;
      history_total_pages = result.total_pages;
    } catch (err) {
      console.error('Failed to load history:', err);
      toast_store.error('Failed to load history');
      history = [];
    }
  }

  async function load_all() {
    await Promise.all([load_pipeline(), load_queue(), load_history()]);
    loading = false;
  }

  async function refresh_log() {
    log_loading = true;
    try {
      const result = await api.pipeline_log();
      log_text = result.log;
    } catch (err) {
      console.error('Failed to load log:', err);
      toast_store.error('Failed to load log');
      log_text = 'Failed to load log.';
    } finally {
      log_loading = false;
    }
  }

  // Poll every 3s
  use_polling(async () => {
    await Promise.all([load_pipeline(), load_queue()]);
    if (log_visible) refresh_log();
    loading = false;
  }, 3000);

  // Reload history when filter or page changes
  $effect(() => {
    filter_status;
    history_page;
    load_history();
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  async function do_pause() {
    action_busy = true;
    action_error = '';
    try {
      await api.pipeline_pause();
      await load_pipeline();
    } catch (e) {
      action_error = e instanceof Error ? e.message : 'Failed to pause';
    } finally {
      action_busy = false;
    }
  }

  async function do_resume() {
    action_busy = true;
    action_error = '';
    try {
      await api.pipeline_resume();
      await load_pipeline();
    } catch (e) {
      action_error = e instanceof Error ? e.message : 'Failed to resume';
    } finally {
      action_busy = false;
    }
  }

  async function do_stop() {
    if (!confirm('Stop the currently running task?')) return;
    action_busy = true;
    action_error = '';
    try {
      await api.pipeline_stop_current();
      await load_pipeline();
    } catch (e) {
      action_error = e instanceof Error ? e.message : 'Failed to stop';
    } finally {
      action_busy = false;
    }
  }

  async function toggle_log() {
    log_visible = !log_visible;
    if (log_visible) await refresh_log();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function state_icon(state: string) {
    if (state === 'running') return 'play_circle';
    if (state === 'paused') return 'pause_circle';
    return 'radio_button_unchecked';
  }

  function state_label(state: string) {
    if (state === 'running') return 'Running';
    if (state === 'paused') return 'Paused';
    return 'Idle';
  }

  function state_class(state: string) {
    if (state === 'running') return 'running';
    if (state === 'paused') return 'paused';
    return 'idle';
  }

  function format_duration(started_at: string | null): string {
    if (!started_at) return '';
    const elapsed = Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}m ${s}s`;
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

  let expanded_run = $state<string | null>(null);

  function toggle_run_log(id: string) {
    expanded_run = expanded_run === id ? null : id;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h2>Pipeline</h2>
      <p class="subtitle">Execution queue and task history</p>
    </div>
  </div>

  {#if loading}
    <LoadingSpinner label="Loading pipeline..." />
  {:else}
    <!-- ── Status bar ── -->
    <div class="status-bar" class:running={pipeline?.state === 'running'} class:paused={pipeline?.state === 'paused'}>
      <div class="status-left">
        <span class="icon state-icon">{state_icon(pipeline?.state ?? 'idle')}</span>
        <span class="state-label {state_class(pipeline?.state ?? 'idle')}">
          {state_label(pipeline?.state ?? 'idle')}
        </span>
        {#if pipeline && pipeline.queue_depth > 0}
          <span class="queue-badge">{pipeline.queue_depth} queued</span>
        {/if}
      </div>
      <div class="status-right">
        {#if action_error}
          <span class="action-error">{action_error}</span>
        {/if}
        {#if pipeline?.state === 'running'}
          <button class="btn btn-secondary btn-sm" onclick={do_pause} disabled={action_busy}>
            <span class="icon">pause</span> Pause
          </button>
          <button class="btn btn-danger btn-sm" onclick={do_stop} disabled={action_busy}>
            <span class="icon">stop</span> Stop Task
          </button>
        {:else if pipeline?.state === 'paused'}
          <button class="btn btn-primary btn-sm" onclick={do_resume} disabled={action_busy}>
            <span class="icon">play_arrow</span> Resume
          </button>
        {:else}
          <button class="btn btn-primary btn-sm" onclick={do_resume} disabled={action_busy}>
            <span class="icon">play_arrow</span> Start Pipeline
          </button>
        {/if}
      </div>
    </div>

    <!-- ── Currently executing ── -->
    <section class="section">
      <h3 class="section-title">
        <span class="icon">play_arrow</span>
        Currently Executing
      </h3>

      {#if pipeline?.current_task}
        {@const task = pipeline.current_task}
        <div class="current-task-card">
          <div class="current-task-header">
            <div class="current-task-info">
              <p class="task-desc">{task.description}</p>
              <div class="task-meta">
                <span class="icon" style="font-size:14px">category</span>
                {task.feature_title}
                <span class="sep">·</span>
                <span class="icon" style="font-size:14px">folder</span>
                {task.project_name}
                <span class="sep">·</span>
                <span class="icon spin-small" style="font-size:14px">sync</span>
                {format_duration(task.updated_at)}
              </div>
            </div>
            <div class="current-task-actions">
              <button class="btn btn-secondary btn-sm" onclick={toggle_log}>
                <span class="icon">terminal</span>
                {log_visible ? 'Hide Log' : 'View Log'}
              </button>
              <button class="btn btn-danger btn-sm" onclick={do_stop} disabled={action_busy}>
                <span class="icon">stop</span> Stop
              </button>
            </div>
          </div>

          {#if log_visible}
            <div class="log-panel">
              <div class="log-toolbar">
                <span class="log-label">Live Output</span>
                <button class="btn-icon-sm" onclick={refresh_log} disabled={log_loading} title="Refresh">
                  <span class="icon" class:spin={log_loading}>refresh</span>
                </button>
              </div>
              <pre class="log-content">{log_text || '(no output yet)'}</pre>
            </div>
          {/if}
        </div>
      {:else}
        <EmptyState icon="hourglass_empty" message="No task is currently running" />
      {/if}
    </section>

    <!-- ── Queue ── -->
    <section class="section">
      <h3 class="section-title">
        <span class="icon">queue</span>
        Queue
        {#if queue.length > 0}
          <span class="count-badge">{queue.length}</span>
        {/if}
      </h3>

      {#if queue.length === 0}
        <EmptyState icon="done_all" message="No tasks waiting in queue" />
      {:else}
        <div class="queue-list">
          {#each queue as task, i}
            <div class="queue-item">
              <span class="queue-number">{i + 1}</span>
              <span class="queue-desc">{task.description}</span>
              <StatusBadge status={task.status} />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- ── History ── -->
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
          <select class="filter-select" bind:value={filter_status} onchange={() => history_page = 1}>
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
            <button class="btn btn-secondary btn-sm" disabled={history_page <= 1} onclick={() => history_page--}>
              <span class="icon">chevron_left</span>
            </button>
            <span class="page-info">Page {history_page} of {history_total_pages}</span>
            <button class="btn btn-secondary btn-sm" disabled={history_page >= history_total_pages} onclick={() => history_page++}>
              <span class="icon">chevron_right</span>
            </button>
          </div>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .page { max-width: 900px; }

  .page-header { margin-bottom: 1.5rem; }
  .page-header h2 { font-size: 1.5rem; color: var(--fg); }
  .subtitle { color: var(--fg-muted); font-size: 0.875rem; margin-top: 0.2rem; }

  /* Status bar */
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .status-bar.running { border-color: var(--success); }
  .status-bar.paused { border-color: var(--accent); }

  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .state-icon { font-size: 22px; color: var(--fg-muted); }
  .status-bar.running .state-icon { color: var(--success); }
  .status-bar.paused .state-icon { color: var(--accent); }

  .state-label { font-weight: 600; font-size: 0.95rem; color: var(--fg-muted); }
  .state-label.running { color: var(--success); }
  .state-label.paused { color: var(--accent); }

  .queue-badge {
    font-size: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
  }

  .action-error { font-size: 0.8rem; color: var(--danger); }

  /* Sections */
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

  /* Current task card */
  .current-task-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
  }

  .current-task-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .task-desc {
    font-size: 0.95rem;
    color: var(--fg);
    font-weight: 500;
    margin-bottom: 0.35rem;
  }

  .task-meta {
    font-size: 0.8rem;
    color: var(--fg-muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .sep { color: var(--border); }

  .current-task-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Log panel */
  .log-panel {
    margin-top: 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .log-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }

  .log-label { font-size: 0.75rem; color: var(--fg-muted); font-weight: 600; }

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

  /* Queue */
  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .queue-number {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--fg-muted);
    min-width: 1.2rem;
    text-align: center;
  }

  .queue-desc {
    flex: 1;
    font-size: 0.875rem;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* History */
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

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 0.9rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: opacity 0.15s; white-space: nowrap; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); border: 1px solid var(--border); }
  .btn-danger { background: var(--danger); color: #fff; }
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

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .page-info { font-size: 0.8rem; color: var(--fg-muted); }

  /* Animations */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
  .spin-small { animation: spin 2s linear infinite; display: inline-block; }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .page { overflow-x: hidden; }
    .status-bar { flex-direction: column; align-items: flex-start; }
    .status-right { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
    .queue-item { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .item-actions { align-self: flex-end; }
    .pagination { flex-wrap: wrap; gap: 0.5rem; }
  }
</style>

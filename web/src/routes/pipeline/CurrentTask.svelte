<script lang="ts">
  import { EmptyState } from '$lib/components';
  import type { PipelineStatus } from '$lib/types';

  let {
    pipeline,
    log_visible,
    log_text,
    log_loading,
    action_busy,
    ontoggle_log,
    onstop,
    onrefresh_log,
    format_duration,
  }: {
    pipeline: PipelineStatus | null;
    log_visible: boolean;
    log_text: string;
    log_loading: boolean;
    action_busy: boolean;
    ontoggle_log: () => void;
    onstop: () => void;
    onrefresh_log: () => void;
    format_duration: (started_at: string | null) => string;
  } = $props();
</script>

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
          <button class="btn btn-secondary btn-sm" onclick={ontoggle_log}>
            <span class="icon">terminal</span>
            {log_visible ? 'Hide Log' : 'View Log'}
          </button>
          <button class="btn btn-danger btn-sm" onclick={onstop} disabled={action_busy}>
            <span class="icon">stop</span> Stop
          </button>
        </div>
      </div>

      {#if log_visible}
        <div class="log-panel">
          <div class="log-toolbar">
            <span class="log-label">Live Output</span>
            <button class="btn-icon-sm" onclick={onrefresh_log} disabled={log_loading} title="Refresh">
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

  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 0.9rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: opacity 0.15s; white-space: nowrap; font-family: var(--font);
  }
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

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
  .spin-small { animation: spin 2s linear infinite; display: inline-block; }
</style>

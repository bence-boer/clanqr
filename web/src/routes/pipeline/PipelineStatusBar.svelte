<script lang="ts">
  import type { PipelineStatus } from '$lib/types';

  let {
    pipeline,
    action_busy,
    action_error,
    onpause,
    onresume,
    onstop,
  }: {
    pipeline: PipelineStatus | null;
    action_busy: boolean;
    action_error: string;
    onpause: () => void;
    onresume: () => void;
    onstop: () => void;
  } = $props();

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
</script>

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
      <button class="btn btn-secondary btn-sm" onclick={onpause} disabled={action_busy}>
        <span class="icon">pause</span> Pause
      </button>
      <button class="btn btn-danger btn-sm" onclick={onstop} disabled={action_busy}>
        <span class="icon">stop</span> Stop Task
      </button>
    {:else if pipeline?.state === 'paused'}
      <button class="btn btn-primary btn-sm" onclick={onresume} disabled={action_busy}>
        <span class="icon">play_arrow</span> Resume
      </button>
    {:else}
      <button class="btn btn-primary btn-sm" onclick={onresume} disabled={action_busy}>
        <span class="icon">play_arrow</span> Start Pipeline
      </button>
    {/if}
  </div>
</div>

<style>
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

  @media (max-width: 768px) {
    .status-bar { flex-direction: column; align-items: flex-start; }
    .status-right { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
  }
</style>

<script lang="ts">
  import { api } from '$lib/api/client';
  import { use_polling } from '$lib/utils/polling';

  let agent_status = $state<Record<string, any>>({});
  let selected_log = $state<string | null>(null);
  let log_content = $state('');
  let loading = $state(true);
  let stopping = $state(false);

  async function load_status() {
    try {
      agent_status = await api.agent_status();
    } catch (error) {
      console.error('Failed to load agent status:', error);
    } finally {
      loading = false;
    }
  }

  use_polling(load_status, 3000);

  async function view_log(task_id: string) {
    selected_log = task_id;
    try {
      const result = await api.agent_log(task_id);
      log_content = result.log || 'No log output yet.';
    } catch (err) {
      console.error('Failed to load log:', err);
      log_content = 'Failed to load log.';
    }
  }

  async function stop_all() {
    stopping = true;
    try {
      await api.stop_all_agents();
      await load_status();
    } catch (error) {
      console.error('Failed to stop agents:', error);
    } finally {
      stopping = false;
    }
  }

  async function stop_agent(task_id: string) {
    try {
      await api.stop_agent(task_id);
      await load_status();
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  }

  let entries = $derived(Object.entries(agent_status));
  let running_count = $derived(entries.filter(([_, a]) => a.status === 'running').length);
  let completed_count = $derived(entries.filter(([_, a]) => a.status === 'completed').length);
  let failed_count = $derived(entries.filter(([_, a]) => a.status === 'failed').length);
</script>

<div class="page">
  <div class="page-header">
    <h2>Agent Monitoring</h2>
    {#if running_count > 0}
      <button class="btn btn-danger" onclick={stop_all} disabled={stopping}>
        <span class="icon">stop_circle</span>
        {stopping ? 'Stopping...' : 'Stop All'}
      </button>
    {/if}
  </div>

  <div class="stats">
    <div class="stat-card">
      <span class="icon stat-icon" style="color:#6ea8fe">play_circle</span>
      <span class="stat-value running">{running_count}</span>
      <span class="stat-label">Running</span>
    </div>
    <div class="stat-card">
      <span class="icon stat-icon" style="color:var(--success)">check_circle</span>
      <span class="stat-value completed">{completed_count}</span>
      <span class="stat-label">Completed</span>
    </div>
    <div class="stat-card">
      <span class="icon stat-icon" style="color:var(--danger)">error</span>
      <span class="stat-value failed">{failed_count}</span>
      <span class="stat-label">Failed</span>
    </div>
  </div>

  {#if loading}
    <p class="loading"><span class="icon spin">progress_activity</span> Loading agent status...</p>
  {:else if entries.length === 0}
    <div class="empty-state">
      <span class="icon" style="font-size:48px;color:var(--fg-muted)">smart_toy</span>
      <p>No agent processes yet.</p>
      <p class="hint">Submit a feature to trigger the Manager agent, or approve tasks to trigger Ralph agents.</p>
    </div>
  {:else}
    <div class="agent-grid">
      {#each entries as [id, agent]}
        <div class="agent-card" class:running={agent.status === 'running'} class:failed={agent.status === 'failed'}>
          <div class="agent-header">
            <div class="agent-info">
              <span class="icon agent-icon">{agent.type === 'manager' ? 'assignment' : 'build'}</span>
              <div>
                <span class="agent-type">{agent.type}</span>
                <span class="agent-id">{id}</span>
              </div>
            </div>
            <span class="status-badge status-{agent.status}">{agent.status}</span>
          </div>

          <div class="agent-times">
            <span><span class="icon" style="font-size:14px">schedule</span> Started: {new Date(agent.started_at).toLocaleTimeString()}</span>
            {#if agent.finished_at}
              <span><span class="icon" style="font-size:14px">flag</span> Finished: {new Date(agent.finished_at).toLocaleTimeString()}</span>
            {/if}
          </div>

          <div class="agent-actions">
            <button class="btn btn-secondary btn-sm" onclick={() => view_log(id)}>
              <span class="icon" style="font-size:14px">description</span> Log
            </button>
            {#if agent.status === 'running'}
              <button class="btn btn-danger btn-sm" onclick={() => stop_agent(id)}>
                <span class="icon" style="font-size:14px">stop</span> Stop
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if selected_log}
    <div class="log-panel">
      <div class="log-header">
        <h3><span class="icon" style="font-size:16px">terminal</span> Log: {selected_log.slice(0, 8)}...</h3>
        <button class="btn btn-sm btn-secondary" onclick={() => { selected_log = null; log_content = ''; }}>
          <span class="icon" style="font-size:14px">close</span> Close
        </button>
      </div>
      <pre class="log-content">{log_content}</pre>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1000px; }
  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
  }
  .page-header h2 { font-size: 1.5rem; color: var(--fg); }

  .stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 1.25rem; text-align: center;
  }

  .stat-icon { font-size: 24px; display: block; margin-bottom: 0.5rem; }
  .stat-value { display: block; font-size: 2rem; font-weight: 700; }
  .stat-value.running { color: #6ea8fe; }
  .stat-value.completed { color: var(--success); }
  .stat-value.failed { color: var(--danger); }
  .stat-label { display: block; font-size: 0.8rem; color: var(--fg-muted); margin-top: 0.25rem; }

  .btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: var(--font);
  }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); }
  .btn-secondary:hover { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { opacity: 0.9; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  .loading { color: var(--fg-muted); display: flex; align-items: center; gap: 0.5rem; }

  .empty-state {
    text-align: center; padding: 3rem; color: var(--fg-muted);
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  }
  .hint { font-size: 0.85rem; color: var(--fg-muted); opacity: 0.7; }

  .agent-grid { display: flex; flex-direction: column; gap: 0.75rem; }

  .agent-card {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem;
  }
  .agent-card.running { border-color: rgba(106, 168, 254, 0.4); }
  .agent-card.failed { border-color: rgba(201, 84, 74, 0.4); }

  .agent-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;
  }
  .agent-info { display: flex; align-items: center; gap: 0.6rem; }
  .agent-icon { font-size: 24px; color: var(--accent); }
  .agent-type { display: block; font-weight: 600; color: var(--fg); text-transform: capitalize; font-size: 0.9rem; }
  .agent-id { display: block; font-size: 0.7rem; color: var(--fg-muted); font-family: monospace; }

  .status-badge {
    font-size: 0.65rem; padding: 0.2rem 0.55rem; border-radius: 12px;
    font-weight: 600; text-transform: uppercase;
  }
  .status-running { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }
  .status-completed { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .status-failed { background: rgba(201, 84, 74, 0.15); color: var(--danger); }
  .status-stopped { background: var(--bg-elevated); color: var(--fg-muted); }

  .agent-times {
    font-size: 0.8rem; color: var(--fg-muted); display: flex; gap: 1.5rem;
    margin-bottom: 0.5rem; flex-wrap: wrap;
  }
  .agent-times span { display: inline-flex; align-items: center; gap: 0.25rem; }
  .agent-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .log-panel {
    margin-top: 1.5rem; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
  }

  .log-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1rem; background: var(--bg-surface); border-bottom: 1px solid var(--border);
  }
  .log-header h3 {
    font-size: 0.85rem; color: var(--fg); display: flex; align-items: center; gap: 0.4rem;
  }

  .log-content {
    padding: 1rem; font-size: 0.75rem; color: var(--fg-muted); max-height: 500px;
    overflow-y: auto; white-space: pre-wrap; word-break: break-word;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  @media (max-width: 768px) {
    .stats { grid-template-columns: 1fr; }
  }
</style>

<script lang="ts">
  import { api } from '$lib/api/client';

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

  $effect(() => {
    load_status();
    const interval = setInterval(load_status, 3000);
    return () => clearInterval(interval);
  });

  async function view_log(task_id: string) {
    selected_log = task_id;
    try {
      const result = await api.agent_log(task_id);
      log_content = result.log || 'No log output yet.';
    } catch {
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
        {stopping ? 'Stopping...' : '⏹ Stop All Agents'}
      </button>
    {/if}
  </div>

  <div class="stats">
    <div class="stat-card">
      <span class="stat-value running">{running_count}</span>
      <span class="stat-label">Running</span>
    </div>
    <div class="stat-card">
      <span class="stat-value completed">{completed_count}</span>
      <span class="stat-label">Completed</span>
    </div>
    <div class="stat-card">
      <span class="stat-value failed">{failed_count}</span>
      <span class="stat-label">Failed</span>
    </div>
  </div>

  {#if loading}
    <p class="loading">Loading agent status...</p>
  {:else if entries.length === 0}
    <div class="empty-state">
      <p>No agent processes yet.</p>
      <p class="hint">Submit a feature to trigger the Manager agent, or approve tasks to trigger Ralph agents.</p>
    </div>
  {:else}
    <div class="agent-grid">
      {#each entries as [id, agent]}
        <div class="agent-card" class:running={agent.status === 'running'} class:failed={agent.status === 'failed'}>
          <div class="agent-header">
            <div class="agent-info">
              <span class="agent-icon">{agent.type === 'manager' ? '📋' : '🔨'}</span>
              <div>
                <span class="agent-type">{agent.type}</span>
                <span class="agent-id">{id}</span>
              </div>
            </div>
            <span class="status-badge status-{agent.status}">{agent.status}</span>
          </div>

          <div class="agent-times">
            <span>Started: {new Date(agent.started_at).toLocaleTimeString()}</span>
            {#if agent.finished_at}
              <span>Finished: {new Date(agent.finished_at).toLocaleTimeString()}</span>
            {/if}
          </div>

          <div class="agent-actions">
            <button class="btn btn-secondary btn-sm" onclick={() => view_log(id)}>📄 View Log</button>
            {#if agent.status === 'running'}
              <button class="btn btn-danger btn-sm" onclick={() => stop_agent(id)}>⏹ Stop</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if selected_log}
    <div class="log-panel">
      <div class="log-header">
        <h3>Log: {selected_log}</h3>
        <button class="btn btn-sm btn-secondary" onclick={() => { selected_log = null; log_content = ''; }}>Close</button>
      </div>
      <pre class="log-content">{log_content}</pre>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1000px; }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .page-header h2 { font-size: 1.5rem; color: #fff; }

  .stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;
  }

  .stat-card {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;
    padding: 1.25rem; text-align: center;
  }

  .stat-value { display: block; font-size: 2rem; font-weight: 700; }
  .stat-value.running { color: #6ea8fe; }
  .stat-value.completed { color: #4caf50; }
  .stat-value.failed { color: #dc2626; }
  .stat-label { display: block; font-size: 0.85rem; color: #888; margin-top: 0.25rem; }

  .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn-secondary { background: #333; color: #ddd; }
  .btn-secondary:hover { background: #444; }
  .btn-danger { background: #dc2626; color: #fff; }
  .btn-danger:hover { background: #b91c1c; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  .loading { color: #888; }

  .empty-state { text-align: center; padding: 3rem; color: #555; }
  .hint { font-size: 0.85rem; margin-top: 0.5rem; color: #444; }

  .agent-grid { display: flex; flex-direction: column; gap: 0.75rem; }

  .agent-card {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1rem;
  }
  .agent-card.running { border-color: #1a3a5c; }
  .agent-card.failed { border-color: #5c1a1a; }

  .agent-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .agent-info { display: flex; align-items: center; gap: 0.75rem; }
  .agent-icon { font-size: 1.5rem; }
  .agent-type { display: block; font-weight: 600; color: #fff; text-transform: capitalize; font-size: 0.9rem; }
  .agent-id { display: block; font-size: 0.75rem; color: #666; font-family: monospace; }

  .status-badge {
    font-size: 0.7rem; padding: 0.2rem 0.6rem; border-radius: 12px;
    font-weight: 600; text-transform: uppercase;
  }
  .status-running { background: #1a3a5c; color: #6ea8fe; }
  .status-completed { background: #0f3d0f; color: #4caf50; }
  .status-failed { background: #3d0f0f; color: #dc2626; }
  .status-stopped { background: #333; color: #aaa; }

  .agent-times { font-size: 0.8rem; color: #666; display: flex; gap: 1.5rem; margin-bottom: 0.5rem; }
  .agent-actions { display: flex; gap: 0.5rem; }

  .log-panel {
    margin-top: 1.5rem; background: #111; border: 1px solid #2a2a2a;
    border-radius: 8px; overflow: hidden;
  }

  .log-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1rem; background: #1a1a1a; border-bottom: 1px solid #2a2a2a;
  }

  .log-header h3 { font-size: 0.9rem; color: #ccc; }

  .log-content {
    padding: 1rem; font-size: 0.75rem; color: #aaa; max-height: 500px;
    overflow-y: auto; white-space: pre-wrap; word-break: break-word;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
</style>

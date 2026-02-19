<script lang="ts">
  import { api } from '$lib/api/client';
  import type { PipelineStatus, Project, SystemStats } from '$lib/types';

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let pipeline = $state<PipelineStatus | null>(null);
  let system_stats = $state<SystemStats | null>(null);
  let stats_auto_refresh = $state(false);
  let stats_interval_id: ReturnType<typeof setInterval> | null = null;

  async function load_data() {
    try {
      const [project_list, pipeline_status] = await Promise.all([
        api.list_projects(),
        api.pipeline_status().catch(() => null),
      ]);
      projects = project_list;
      pipeline = pipeline_status;
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      loading = false;
    }
  }

  async function load_system_stats() {
    try {
      system_stats = await api.system_stats();
    } catch {
      // silently fail
    }
  }

  $effect(() => {
    load_data();
    load_system_stats();
    const interval = setInterval(load_data, 5000);
    return () => clearInterval(interval);
  });

  function toggle_stats_refresh() {
    stats_auto_refresh = !stats_auto_refresh;
    if (stats_interval_id) {
      clearInterval(stats_interval_id);
      stats_interval_id = null;
    }
    if (stats_auto_refresh) {
      stats_interval_id = setInterval(load_system_stats, 15000);
    }
  }

  let total_features = $derived(projects.reduce((sum, project) => sum + (project.features?.length ?? 0), 0));

  function pipeline_state_label(state: string) {
    if (state === 'running') return 'Running';
    if (state === 'paused') return 'Paused';
    return 'Idle';
  }

  function pipeline_state_color(state: string) {
    if (state === 'running') return '#6ea8fe';
    if (state === 'paused') return 'var(--accent)';
    return 'var(--fg-muted)';
  }
</script>

<div class="dashboard">
  <h2>Dashboard</h2>

  {#if loading}
    <p class="loading"><span class="icon spin">progress_activity</span> Loading...</p>
  {:else}
    <div class="stats">
      <div class="stat-card">
        <span class="icon stat-icon">folder</span>
        <span class="stat-value">{projects.length}</span>
        <span class="stat-label">Projects</span>
      </div>
      <div class="stat-card">
        <span class="icon stat-icon">category</span>
        <span class="stat-value">{total_features}</span>
        <span class="stat-label">Features</span>
      </div>
      <div class="stat-card pipeline-stat" style="--state-color: {pipeline ? pipeline_state_color(pipeline.state) : 'var(--fg-muted)'}">
        <span class="icon stat-icon">account_tree</span>
        <span class="stat-value">{pipeline ? pipeline_state_label(pipeline.state) : '—'}</span>
        <span class="stat-label">Pipeline · {pipeline?.queue_depth ?? 0} queued</span>
      </div>
    </div>

    <!-- System Stats Card -->
    <section class="section">
      <div class="section-header">
        <h3>System Stats</h3>
        <div class="section-actions">
          <button class="btn-icon" onclick={load_system_stats} title="Refresh stats">
            <span class="icon">refresh</span>
          </button>
          <button
            class="btn-toggle"
            class:active={stats_auto_refresh}
            onclick={toggle_stats_refresh}
            title="Auto-refresh every 15s"
          >
            <span class="icon">update</span>
            Auto-refresh
          </button>
        </div>
      </div>

      {#if system_stats}
        <div class="system-stats-grid">
          <div class="sys-stat">
            <span class="sys-label">CPU</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {system_stats.cpu_percent}%"></div>
            </div>
            <span class="sys-value">{system_stats.cpu_percent}%</span>
          </div>
          <div class="sys-stat">
            <span class="sys-label">Memory</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {system_stats.memory_percent}%"></div>
            </div>
            <span class="sys-value">{system_stats.memory_percent}% of {Math.round(system_stats.memory_total_mb / 1024)}GB</span>
          </div>
          <div class="sys-stat">
            <span class="sys-label">Storage</span>
            <div class="progress-bar">
              <div class="progress-fill" class:high={system_stats.storage_percent > 80} style="width: {system_stats.storage_percent}%"></div>
            </div>
            <span class="sys-value">{system_stats.storage_percent}% of {system_stats.storage_total_gb.toFixed(0)}GB</span>
          </div>
          {#if system_stats.cpu_temp_celsius !== null}
            <div class="sys-stat">
              <span class="sys-label">Temperature</span>
              <div class="progress-bar">
                <div class="progress-fill" class:warm={system_stats.cpu_temp_celsius > 60} style="width: {Math.min(system_stats.cpu_temp_celsius, 100)}%"></div>
              </div>
              <span class="sys-value">{system_stats.cpu_temp_celsius}°C</span>
            </div>
          {/if}
        </div>
      {:else}
        <p class="muted-text">Stats unavailable</p>
      {/if}
    </section>

    <!-- Pipeline Status Card -->
    {#if pipeline}
      <section class="section">
        <div class="section-header">
          <h3>Pipeline</h3>
          <a href="/pipeline" class="btn-link">View details →</a>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-state" style="color: {pipeline_state_color(pipeline.state)}">
            <span class="icon">{pipeline.state === 'running' ? 'play_circle' : pipeline.state === 'paused' ? 'pause_circle' : 'radio_button_unchecked'}</span>
            {pipeline_state_label(pipeline.state)}
          </div>
          <div class="pipeline-meta">
            <span class="icon meta-icon">queue</span>
            {pipeline.queue_depth} task{pipeline.queue_depth !== 1 ? 's' : ''} queued
          </div>
          <div class="pipeline-actions">
            {#if pipeline.state === 'running'}
              <button class="btn btn-sm" onclick={() => api.pipeline_pause().then(load_data)}>
                <span class="icon">pause</span> Pause
              </button>
            {:else if pipeline.state === 'paused'}
              <button class="btn btn-sm btn-accent" onclick={() => api.pipeline_resume().then(load_data)}>
                <span class="icon">play_arrow</span> Resume
              </button>
            {:else if pipeline.queue_depth > 0}
              <a href="/pipeline" class="btn btn-sm btn-accent">
                <span class="icon">play_arrow</span> View Queue
              </a>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    <!-- Quick Actions -->
    <section class="section">
      <h3>Quick Actions</h3>
      <div class="quick-actions">
        <a href="/projects" class="action-card">
          <span class="icon action-icon">add</span>
          <span>New Project</span>
        </a>
        <a href="/chat" class="action-card">
          <span class="icon action-icon">chat</span>
          <span>Open Chat</span>
        </a>
        <a href="/pipeline" class="action-card">
          <span class="icon action-icon">account_tree</span>
          <span>View Pipeline</span>
        </a>
        <a href="/prompts" class="action-card">
          <span class="icon action-icon">tune</span>
          <span>Manage Prompts</span>
        </a>
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: var(--fg);
  }

  .loading {
    color: var(--fg-muted);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    text-align: center;
  }

  .stat-icon {
    font-size: 24px;
    color: var(--accent);
    display: block;
    margin-bottom: 0.5rem;
  }

  .pipeline-stat .stat-value {
    color: var(--state-color);
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: var(--fg);
  }

  .stat-label {
    display: block;
    font-size: 0.8rem;
    color: var(--fg-muted);
    margin-top: 0.25rem;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .section-header h3,
  .section h3 {
    font-size: 1.05rem;
    color: var(--fg);
    margin: 0 0 1rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-icon {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg-muted);
    padding: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }

  .btn-icon:hover { color: var(--fg); }

  .btn-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg-muted);
    font-size: 0.8rem;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
  }

  .btn-toggle.active {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* System stats */
  .system-stats-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
  }

  .sys-stat {
    display: grid;
    grid-template-columns: 90px 1fr 80px;
    align-items: center;
    gap: 0.75rem;
  }

  .sys-label {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  .sys-value {
    font-size: 0.8rem;
    color: var(--fg);
    text-align: right;
  }

  .progress-bar {
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-fill.high { background: var(--danger); }
  .progress-fill.warm { background: #f4a261; }

  /* Pipeline card */
  .pipeline-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    flex-wrap: wrap;
  }

  .pipeline-state {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }

  .pipeline-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.875rem;
    color: var(--fg-muted);
  }

  .meta-icon { font-size: 16px; }

  .pipeline-actions { margin-left: auto; }

  .btn-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.8rem;
    cursor: pointer;
    font-family: var(--font);
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn:hover { background: var(--bg); }
  .btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
  .btn-accent { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

  /* Quick actions */
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    text-decoration: none;
    color: var(--fg-muted);
    font-size: 0.8rem;
    transition: all 0.15s;
  }

  .action-card:hover {
    background: var(--bg-elevated);
    color: var(--fg);
    border-color: var(--accent);
  }

  .action-icon {
    font-size: 22px;
    color: var(--accent);
  }

  .muted-text {
    color: var(--fg-muted);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .stats { grid-template-columns: 1fr; }
    .quick-actions { grid-template-columns: repeat(2, 1fr); }
    .sys-stat { grid-template-columns: 80px 1fr 70px; }
  }
</style>

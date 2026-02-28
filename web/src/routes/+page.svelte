<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import { use_polling } from '$lib/utils/polling.svelte';
  import type { PipelineStatus, Project, SystemStats } from '$lib/types';
  import PipelineCard from './PipelineCard.svelte';
  import SystemStatsCard from './SystemStatsCard.svelte';

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
      polling.mark_success();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast_store.error('Failed to load dashboard');
    } finally {
      loading = false;
    }
  }

  async function load_system_stats() {
    try {
      system_stats = await api.system_stats();
    } catch (err) {
      console.error('Failed to load system stats:', err);
      toast_store.error('Failed to load system stats');
    }
  }

  const polling = use_polling(load_data, 5000);

  onMount(() => {
    load_system_stats();
  });

  onDestroy(() => {
    if (stats_interval_id) {
      clearInterval(stats_interval_id);
      stats_interval_id = null;
    }
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

<div class="dashboard" aria-busy={loading}>
  <h2>Dashboard</h2>

  {#if polling.is_stale}
    <div class="stale-banner" role="alert">
      <span class="icon" style="font-size:16px">warning</span>
      Data may be outdated — unable to reach server
    </div>
  {/if}

  {#if loading}
    <p class="loading"><span class="icon spin">progress_activity</span> Loading...</p>
  {:else}
    <div class="stats">
      <a href="/projects" class="stat-card">
        <span class="icon stat-icon">folder</span>
        <span class="stat-value">{projects.length}</span>
        <span class="stat-label">Projects</span>
      </a>
      <a href="/projects" class="stat-card">
        <span class="icon stat-icon">category</span>
        <span class="stat-value">{total_features}</span>
        <span class="stat-label">Features</span>
      </a>
      <a href="/pipeline" class="stat-card pipeline-stat" style="--state-color: {pipeline ? pipeline_state_color(pipeline.state) : 'var(--fg-muted)'}">
        <span class="icon stat-icon">account_tree</span>
        <span class="stat-value">{pipeline ? pipeline_state_label(pipeline.state) : '—'}</span>
        <span class="stat-label">Pipeline · {pipeline?.queue_depth ?? 0} queued</span>
      </a>
    </div>

    <SystemStatsCard
      {system_stats}
      {stats_auto_refresh}
      onrefresh={load_system_stats}
      ontoggle_auto_refresh={toggle_stats_refresh}
    />

    <PipelineCard
      {pipeline}
      onpause={() => api.pipeline_pause().then(load_data)}
      onresume={() => api.pipeline_resume().then(load_data)}
    />

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
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .stat-card:hover {
    border-color: var(--accent);
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

  .section h3 {
    font-size: 1.05rem;
    color: var(--fg);
    margin: 0 0 1rem;
  }

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

  @media (max-width: 768px) {
    .stats { grid-template-columns: repeat(3, 1fr); }
    .stat-card { padding: 0.75rem 0.5rem; }
    .stat-value { font-size: 1.25rem; }
    .quick-actions { grid-template-columns: repeat(2, 1fr); }
  }
</style>

<script lang="ts">
  import { api } from '$lib/api/client';
  import type { Project, Feature, Task } from '$lib/types';

  let projects = $state<Project[]>([]);
  let recent_features = $state<Feature[]>([]);
  let agent_status = $state<Record<string, any>>({});
  let loading = $state(true);

  async function load_data() {
    try {
      const [p, f, s] = await Promise.all([
        api.list_projects(),
        api.list_features(),
        api.agent_status(),
      ]);
      projects = p;
      recent_features = f.slice(0, 5);
      agent_status = s;
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load_data();
    const interval = setInterval(load_data, 5000);
    return () => clearInterval(interval);
  });

  let running_agents = $derived(
    Object.values(agent_status).filter((a: any) => a.status === 'running').length
  );
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
        <span class="stat-value">{recent_features.length}</span>
        <span class="stat-label">Features</span>
      </div>
      <div class="stat-card">
        <span class="icon stat-icon">smart_toy</span>
        <span class="stat-value">{running_agents}</span>
        <span class="stat-label">Running Agents</span>
      </div>
    </div>

    <section class="section">
      <h3>Recent Features</h3>
      {#if recent_features.length === 0}
        <p class="empty">No features yet. <a href="/projects">Create a project</a> to get started.</p>
      {:else}
        <div class="feature-list">
          {#each recent_features as feature}
            <div class="feature-card">
              <div class="feature-header">
                <span class="feature-title">{feature.title}</span>
                <span class="badge badge-{feature.status.toLowerCase()}">{feature.status}</span>
              </div>
              <p class="feature-desc">{feature.description ?? 'No description'}</p>
              <div class="feature-meta">
                <span><span class="icon meta-icon">task</span> {feature.tasks?.length ?? 0} tasks</span>
                <span><span class="icon meta-icon">link</span> {feature.resources?.length ?? 0} resources</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    {#if running_agents > 0}
      <section class="section">
        <h3>Active Agents</h3>
        <div class="agent-list">
          {#each Object.entries(agent_status) as [id, agent]}
            {#if agent.status === 'running'}
              <div class="agent-card">
                <span class="icon agent-icon">{agent.type === 'manager' ? 'assignment' : 'build'}</span>
                <span class="agent-type">{agent.type}</span>
                <span class="agent-id">{id.slice(0, 8)}</span>
                <span class="badge badge-running">Running</span>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}
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
    margin-bottom: 1rem;
  }

  .empty {
    color: var(--fg-muted);
    font-size: 0.9rem;
  }

  .empty a {
    color: var(--accent);
  }

  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
  }

  .feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .feature-title {
    font-weight: 600;
    color: var(--fg);
  }

  .feature-desc {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin-bottom: 0.5rem;
  }

  .feature-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--fg-muted);
    flex-wrap: wrap;
  }

  .feature-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-icon {
    font-size: 16px;
  }

  .badge {
    font-size: 0.65rem;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .badge-draft { background: var(--bg-elevated); color: var(--fg-muted); }
  .badge-submitted { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }
  .badge-in_progress { background: var(--accent-dim); color: var(--accent); }
  .badge-done { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .badge-running { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }

  .agent-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
  }

  .agent-icon {
    color: var(--accent);
  }

  .agent-type {
    font-weight: 600;
    text-transform: capitalize;
  }

  .agent-id {
    color: var(--fg-muted);
    font-size: 0.8rem;
    font-family: monospace;
  }

  @media (max-width: 768px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>

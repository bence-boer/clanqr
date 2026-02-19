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
    <p class="loading">Loading...</p>
  {:else}
    <div class="stats">
      <div class="stat-card">
        <span class="stat-value">{projects.length}</span>
        <span class="stat-label">Projects</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{recent_features.length}</span>
        <span class="stat-label">Features</span>
      </div>
      <div class="stat-card">
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
                <span>{feature.tasks?.length ?? 0} tasks</span>
                <span>{feature.resources?.length ?? 0} resources</span>
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
                <span class="agent-type">{agent.type === 'manager' ? '📋' : '🔨'} {agent.type}</span>
                <span class="agent-id">{id}</span>
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
    color: #fff;
  }

  .loading {
    color: #888;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
  }

  .stat-label {
    display: block;
    font-size: 0.85rem;
    color: #888;
    margin-top: 0.25rem;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h3 {
    font-size: 1.1rem;
    color: #ccc;
    margin-bottom: 1rem;
  }

  .empty {
    color: #666;
    font-size: 0.9rem;
  }

  .empty a {
    color: #6ea8fe;
  }

  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-card {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }

  .feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .feature-title {
    font-weight: 600;
    color: #fff;
  }

  .feature-desc {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 0.5rem;
  }

  .feature-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: #666;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-draft { background: #333; color: #aaa; }
  .badge-submitted { background: #1a3a5c; color: #6ea8fe; }
  .badge-in_progress { background: #3a2f0b; color: #ffc107; }
  .badge-done { background: #0f3d0f; color: #4caf50; }
  .badge-running { background: #1a3a5c; color: #6ea8fe; }

  .agent-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .agent-type {
    font-weight: 600;
    text-transform: capitalize;
  }

  .agent-id {
    color: #666;
    font-size: 0.8rem;
    font-family: monospace;
  }
</style>

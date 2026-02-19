<script lang="ts">
  import { api } from '$lib/api/client';
  import type { Project } from '$lib/types';

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let show_create = $state(false);
  let new_name = $state('');
  let new_description = $state('');
  let creating = $state(false);

  async function load_projects() {
    try {
      projects = await api.list_projects();
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      loading = false;
    }
  }

  async function create_project() {
    if (!new_name.trim()) return;
    creating = true;
    try {
      await api.create_project({
        name: new_name.trim(),
        description: new_description.trim() || undefined,
      });
      new_name = '';
      new_description = '';
      show_create = false;
      await load_projects();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      creating = false;
    }
  }

  async function delete_project(id: string) {
    if (!confirm('Delete this project and all its features?')) return;
    try {
      await api.delete_project(id);
      await load_projects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  $effect(() => {
    load_projects();
  });
</script>

<div class="page">
  <div class="page-header">
    <h2>Projects</h2>
    <button class="btn btn-primary" onclick={() => (show_create = !show_create)}>
      <span class="icon">{show_create ? 'close' : 'add'}</span>
      {show_create ? 'Cancel' : 'New Project'}
    </button>
  </div>

  {#if show_create}
    <form class="create-form" onsubmit={(e) => { e.preventDefault(); create_project(); }}>
      <input
        type="text"
        placeholder="Project name"
        bind:value={new_name}
        class="input"
        required
      />
      <textarea
        placeholder="Description (optional)"
        bind:value={new_description}
        class="input textarea"
        rows="2"
      ></textarea>
      <button type="submit" class="btn btn-primary" disabled={creating || !new_name.trim()}>
        {creating ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  {/if}

  {#if loading}
    <p class="loading"><span class="icon spin">progress_activity</span> Loading projects...</p>
  {:else if projects.length === 0}
    <p class="empty">No projects yet. Create one to get started.</p>
  {:else}
    <div class="project-grid">
      {#each projects as project}
        <a href="/projects/{project.id}" class="project-card">
          <div class="project-header">
            <h3>{project.name}</h3>
            <span class="badge badge-{project.status.toLowerCase()}">{project.status}</span>
          </div>
          <p class="project-desc">{project.description ?? 'No description'}</p>
          <div class="project-footer">
            <span class="date">
              <span class="icon" style="font-size:14px">calendar_today</span>
              {new Date(project.created_at).toLocaleDateString()}
            </span>
            <button
              class="btn btn-danger btn-sm"
              onclick={(e) => { e.preventDefault(); e.stopPropagation(); delete_project(project.id); }}
            >
              <span class="icon" style="font-size:14px">delete</span>
              Delete
            </button>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .page-header h2 {
    font-size: 1.5rem;
    color: var(--fg);
  }

  .create-form {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.6rem 0.8rem;
    color: var(--fg);
    font-size: 0.875rem;
    width: 100%;
    font-family: var(--font);
  }

  .input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .textarea {
    resize: vertical;
    font-family: var(--font);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font);
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    background: var(--danger);
    color: var(--fg);
  }

  .btn-danger:hover {
    opacity: 0.9;
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .loading, .empty {
    color: var(--fg-muted);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .project-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .project-card:hover {
    border-color: var(--accent);
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .project-header h3 {
    font-size: 1.05rem;
    color: var(--fg);
  }

  .project-desc {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin-bottom: 0.75rem;
  }

  .project-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .date {
    font-size: 0.75rem;
    color: var(--fg-muted);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .badge {
    font-size: 0.65rem;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-active { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .badge-archived { background: var(--bg-elevated); color: var(--fg-muted); }

  @media (max-width: 768px) {
    .project-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

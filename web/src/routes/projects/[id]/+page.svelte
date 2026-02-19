<script lang="ts">
  import { page } from '$app/state';
  import { api } from '$lib/api/client';
  import type { Project, Feature, Task } from '$lib/types';

  let project = $state<Project | null>(null);
  let features = $state<Feature[]>([]);
  let loading = $state(true);
  let auto_approve = $state(false);

  // Feature form state
  let show_feature_form = $state(false);
  let feature_title = $state('');
  let feature_description = $state('');
  let feature_resources = $state<{ url: string; title: string }[]>([]);
  let creating_feature = $state(false);

  // Selected feature
  let selected_feature = $state<Feature | null>(null);

  const project_id = $derived(page.params.id);

  async function load_data() {
    try {
      const [p, f] = await Promise.all([
        api.get_project(project_id),
        api.list_features(project_id),
      ]);
      project = p;
      features = f;
      if (selected_feature) {
        selected_feature = f.find((feat: Feature) => feat.id === selected_feature!.id) ?? null;
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    project_id;
    loading = true;
    load_data();
    const interval = setInterval(load_data, 5000);
    return () => clearInterval(interval);
  });

  function add_resource_field() {
    feature_resources = [...feature_resources, { url: '', title: '' }];
  }

  function remove_resource(index: number) {
    feature_resources = feature_resources.filter((_, i) => i !== index);
  }

  async function create_feature() {
    if (!feature_title.trim()) return;
    creating_feature = true;
    try {
      const resources = feature_resources
        .filter((r) => r.url.trim())
        .map((r) => ({ url: r.url.trim(), title: r.title.trim() || undefined }));

      await api.create_feature({
        project_id: project_id,
        title: feature_title.trim(),
        description: feature_description.trim() || undefined,
        resources: resources.length > 0 ? resources : undefined,
      });
      feature_title = '';
      feature_description = '';
      feature_resources = [];
      show_feature_form = false;
      await load_data();
    } catch (error) {
      console.error('Failed to create feature:', error);
    } finally {
      creating_feature = false;
    }
  }

  async function submit_feature(feature_id: string) {
    try {
      await api.submit_feature(feature_id);
      await load_data();
    } catch (error) {
      console.error('Failed to submit feature:', error);
    }
  }

  async function delete_feature(feature_id: string) {
    if (!confirm('Delete this feature?')) return;
    try {
      await api.delete_feature(feature_id);
      if (selected_feature?.id === feature_id) selected_feature = null;
      await load_data();
    } catch (error) {
      console.error('Failed to delete feature:', error);
    }
  }

  async function approve_task(task_id: string) {
    try {
      await api.approve_task(task_id);
      await load_data();
    } catch (error) {
      console.error('Failed to approve task:', error);
    }
  }

  async function approve_all(feature_id: string) {
    try {
      await api.approve_all_tasks(feature_id);
      await load_data();
    } catch (error) {
      console.error('Failed to approve tasks:', error);
    }
  }

  async function spawn_ralph(task_id: string) {
    try {
      await api.spawn_ralph(task_id);
      await load_data();
    } catch (error) {
      console.error('Failed to spawn ralph:', error);
    }
  }

  function status_color(status: string): string {
    const map: Record<string, string> = {
      draft: '#888', submitted: '#6ea8fe', in_progress: '#ffc107', done: '#4caf50',
      pending_approval: '#ff9800', approved: '#6ea8fe', complete: '#4caf50',
      pending: '#888', fetched: '#4caf50', error: '#dc2626',
    };
    return map[status.toLowerCase()] ?? '#888';
  }
</script>

<div class="page">
  {#if loading}
    <p class="loading">Loading...</p>
  {:else if !project}
    <p class="error">Project not found</p>
  {:else}
    <div class="page-header">
      <div>
        <a href="/projects" class="back-link">← Projects</a>
        <h2>{project.name}</h2>
        <p class="project-desc">{project.description ?? ''}</p>
      </div>
      <button class="btn btn-primary" onclick={() => (show_feature_form = !show_feature_form)}>
        {show_feature_form ? 'Cancel' : '+ New Feature'}
      </button>
    </div>

    {#if show_feature_form}
      <form class="create-form" onsubmit={(e) => { e.preventDefault(); create_feature(); }}>
        <input type="text" placeholder="Feature title" bind:value={feature_title} class="input" required />
        <textarea placeholder="Description (supports rich text)" bind:value={feature_description} class="input textarea" rows="4"></textarea>
        <div class="resources-section">
          <div class="resources-header">
            <span>Resources</span>
            <button type="button" class="btn btn-sm btn-secondary" onclick={add_resource_field}>+ Add URL</button>
          </div>
          {#each feature_resources as resource, index}
            <div class="resource-row">
              <input type="url" placeholder="https://..." bind:value={resource.url} class="input" />
              <input type="text" placeholder="Title" bind:value={resource.title} class="input input-sm" />
              <button type="button" class="btn btn-danger btn-sm" onclick={() => remove_resource(index)}>×</button>
            </div>
          {/each}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" disabled={creating_feature || !feature_title.trim()}>
            {creating_feature ? 'Creating...' : 'Save Draft'}
          </button>
        </div>
      </form>
    {/if}

    <div class="content-grid">
      <div class="features-panel">
        <h3>Features ({features.length})</h3>
        {#if features.length === 0}
          <p class="empty">No features yet.</p>
        {:else}
          {#each features as feature}
            <button
              class="feature-item"
              class:selected={selected_feature?.id === feature.id}
              onclick={() => (selected_feature = feature)}
            >
              <div class="feature-item-header">
                <span class="feature-name">{feature.title}</span>
                <span class="badge" style="color: {status_color(feature.status)}">{feature.status.replace('_', ' ')}</span>
              </div>
              <div class="feature-item-meta">
                {feature.tasks?.length ?? 0} tasks · {feature.resources?.length ?? 0} resources
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="detail-panel">
        {#if selected_feature}
          <div class="detail-header">
            <h3>{selected_feature.title}</h3>
            <div class="detail-actions">
              {#if selected_feature.status === 'Draft'}
                <button class="btn btn-primary btn-sm" onclick={() => submit_feature(selected_feature!.id)}>
                  Submit for Implementation
                </button>
              {/if}
              <button class="btn btn-danger btn-sm" onclick={() => delete_feature(selected_feature!.id)}>Delete</button>
            </div>
          </div>

          <div class="detail-body">
            <div class="detail-section">
              <h4>Description</h4>
              <div class="description-text">{selected_feature.description ?? 'No description'}</div>
            </div>

            {#if selected_feature.resources && selected_feature.resources.length > 0}
              <div class="detail-section">
                <h4>Resources</h4>
                <ul class="resource-list">
                  {#each selected_feature.resources as resource}
                    <li>
                      <a href={resource.url} target="_blank" rel="noopener">{resource.title ?? resource.url}</a>
                      <span class="badge" style="color: {status_color(resource.status)}">{resource.status}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <div class="detail-section">
              <div class="tasks-header">
                <h4>Tasks ({selected_feature.tasks?.length ?? 0})</h4>
                <div class="tasks-actions">
                  <label class="toggle-label">
                    <input type="checkbox" bind:checked={auto_approve} />
                    Auto-Approve
                  </label>
                  {#if selected_feature.tasks?.some((t: Task) => t.status === 'Pending_Approval')}
                    <button class="btn btn-secondary btn-sm" onclick={() => approve_all(selected_feature!.id)}>
                      Approve All
                    </button>
                  {/if}
                </div>
              </div>

              {#if !selected_feature.tasks || selected_feature.tasks.length === 0}
                <p class="empty">No tasks yet. Submit the feature to generate tasks via Manager agent.</p>
              {:else}
                <div class="task-list">
                  {#each selected_feature.tasks as task}
                    <div class="task-item">
                      <div class="task-header">
                        <span class="task-desc">{task.description}</span>
                        <span class="badge" style="color: {status_color(task.status)}">{task.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div class="task-actions">
                        {#if task.status === 'Pending_Approval'}
                          <button class="btn btn-primary btn-sm" onclick={() => approve_task(task.id)}>Approve</button>
                        {/if}
                        {#if task.status === 'Approved'}
                          <button class="btn btn-secondary btn-sm" onclick={() => spawn_ralph(task.id)}>▶ Run Ralph</button>
                        {/if}
                        {#if task.agent_log}
                          <details class="log-details">
                            <summary>View Log</summary>
                            <pre class="log-content">{task.agent_log}</pre>
                          </details>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty-detail">
            <p>Select a feature to view details</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1100px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  .back-link { color: #6ea8fe; text-decoration: none; font-size: 0.85rem; }
  .page-header h2 { font-size: 1.5rem; color: #fff; margin-top: 0.25rem; }
  .project-desc { color: #888; font-size: 0.9rem; }

  .create-form {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;
    padding: 1.25rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
  }

  .input {
    background: #0f0f0f; border: 1px solid #333; border-radius: 6px;
    padding: 0.6rem 0.8rem; color: #e0e0e0; font-size: 0.9rem; width: 100%;
  }
  .input:focus { outline: none; border-color: #6ea8fe; }
  .textarea { resize: vertical; font-family: inherit; }
  .input-sm { max-width: 200px; }

  .resources-section { margin-top: 0.5rem; }
  .resources-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem; color: #aaa; }
  .resource-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
  .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn-primary { background: #2563eb; color: #fff; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: #333; color: #ddd; }
  .btn-secondary:hover { background: #444; }
  .btn-danger { background: #dc2626; color: #fff; }
  .btn-danger:hover { background: #b91c1c; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  .content-grid { display: grid; grid-template-columns: 300px 1fr; gap: 1rem; min-height: 500px; }

  .features-panel { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1rem; }
  .features-panel h3 { font-size: 1rem; color: #ccc; margin-bottom: 0.75rem; }

  .feature-item {
    display: block; width: 100%; text-align: left; background: transparent;
    border: 1px solid #2a2a2a; border-radius: 6px; padding: 0.75rem;
    margin-bottom: 0.5rem; cursor: pointer; color: inherit; transition: all 0.15s;
    font-family: inherit; font-size: inherit;
  }
  .feature-item:hover { border-color: #444; }
  .feature-item.selected { border-color: #2563eb; background: #111; }

  .feature-item-header { display: flex; justify-content: space-between; align-items: center; }
  .feature-name { font-weight: 600; color: #fff; font-size: 0.9rem; }
  .feature-item-meta { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }

  .detail-panel { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1.25rem; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #2a2a2a; }
  .detail-header h3 { font-size: 1.1rem; color: #fff; }
  .detail-actions { display: flex; gap: 0.5rem; }

  .detail-section { margin-bottom: 1.25rem; }
  .detail-section h4 { font-size: 0.9rem; color: #aaa; margin-bottom: 0.5rem; }
  .description-text { font-size: 0.9rem; color: #ccc; line-height: 1.5; white-space: pre-wrap; }

  .resource-list { list-style: none; }
  .resource-list li { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid #222; }
  .resource-list a { color: #6ea8fe; text-decoration: none; font-size: 0.85rem; }

  .tasks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .tasks-header h4 { margin-bottom: 0; }
  .tasks-actions { display: flex; gap: 0.75rem; align-items: center; }
  .toggle-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: #aaa; cursor: pointer; }

  .task-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .task-item { background: #111; border: 1px solid #252525; border-radius: 6px; padding: 0.75rem; }
  .task-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
  .task-desc { font-size: 0.85rem; color: #ddd; }
  .task-actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

  .badge { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
  .empty, .loading { color: #666; font-size: 0.85rem; }
  .empty-detail { display: flex; align-items: center; justify-content: center; height: 200px; color: #555; }

  .log-details { width: 100%; }
  .log-details summary { cursor: pointer; font-size: 0.8rem; color: #6ea8fe; }
  .log-content {
    background: #0a0a0a; border: 1px solid #222; border-radius: 4px; padding: 0.75rem;
    font-size: 0.75rem; color: #aaa; max-height: 300px; overflow-y: auto;
    white-space: pre-wrap; word-break: break-word; margin-top: 0.5rem;
  }
</style>

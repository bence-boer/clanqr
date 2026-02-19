<script lang="ts">
  import { page } from '$app/state';
  import { api } from '$lib/api/client';
  import type { Project, Feature, Task } from '$lib/types';

  let project = $state<Project | null>(null);
  let features = $state<Feature[]>([]);
  let loading = $state(true);
  let auto_approve = $state(false);

  let show_feature_form = $state(false);
  let feature_title = $state('');
  let feature_description = $state('');
  let feature_resources = $state<{ url: string; title: string }[]>([]);
  let creating_feature = $state(false);

  let selected_feature = $state<Feature | null>(null);
  let show_mobile_detail = $state(false);

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
      if (selected_feature?.id === feature_id) {
        selected_feature = null;
        show_mobile_detail = false;
      }
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

  function select_feature(feature: Feature) {
    selected_feature = feature;
    show_mobile_detail = true;
  }

  function status_icon(status: string): string {
    const map: Record<string, string> = {
      draft: 'edit_note', submitted: 'send', in_progress: 'sync', done: 'check_circle',
      pending_approval: 'pending', approved: 'thumb_up', complete: 'check_circle',
      pending: 'hourglass_empty', fetched: 'check', error: 'error',
    };
    return map[status.toLowerCase()] ?? 'help';
  }

  function status_class(status: string): string {
    const map: Record<string, string> = {
      draft: 'muted', submitted: 'info', in_progress: 'warn', done: 'success',
      pending_approval: 'warn', approved: 'info', complete: 'success',
      pending: 'muted', fetched: 'success', error: 'danger',
    };
    return map[status.toLowerCase()] ?? 'muted';
  }
</script>

<div class="page">
  {#if loading}
    <p class="loading"><span class="icon spin">progress_activity</span> Loading...</p>
  {:else if !project}
    <p class="error">Project not found</p>
  {:else}
    <div class="page-header">
      <div>
        <a href="/projects" class="back-link">
          <span class="icon" style="font-size:16px">arrow_back</span> Projects
        </a>
        <h2>{project.name}</h2>
        {#if project.description}
          <p class="project-desc">{project.description}</p>
        {/if}
      </div>
      <button class="btn btn-primary" onclick={() => (show_feature_form = !show_feature_form)}>
        <span class="icon">{show_feature_form ? 'close' : 'add'}</span>
        {show_feature_form ? 'Cancel' : 'New Feature'}
      </button>
    </div>

    {#if show_feature_form}
      <form class="create-form" onsubmit={(e) => { e.preventDefault(); create_feature(); }}>
        <input type="text" placeholder="Feature title" bind:value={feature_title} class="input" required />
        <textarea placeholder="Description" bind:value={feature_description} class="input textarea" rows="4"></textarea>
        <div class="resources-section">
          <div class="resources-header">
            <span><span class="icon" style="font-size:16px">link</span> Resources</span>
            <button type="button" class="btn btn-sm btn-secondary" onclick={add_resource_field}>
              <span class="icon" style="font-size:14px">add</span> Add URL
            </button>
          </div>
          {#each feature_resources as resource, index}
            <div class="resource-row">
              <input type="url" placeholder="https://..." bind:value={resource.url} class="input" />
              <input type="text" placeholder="Title" bind:value={resource.title} class="input input-title" />
              <button type="button" class="btn btn-danger btn-icon" onclick={() => remove_resource(index)}>
                <span class="icon" style="font-size:16px">close</span>
              </button>
            </div>
          {/each}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" disabled={creating_feature || !feature_title.trim()}>
            <span class="icon" style="font-size:16px">save</span>
            {creating_feature ? 'Creating...' : 'Save Draft'}
          </button>
        </div>
      </form>
    {/if}

    <div class="content-grid" class:show-detail={show_mobile_detail}>
      <div class="features-panel">
        <h3><span class="icon" style="font-size:18px">category</span> Features ({features.length})</h3>
        {#if features.length === 0}
          <p class="empty">No features yet.</p>
        {:else}
          {#each features as feature}
            <button
              class="feature-item"
              class:selected={selected_feature?.id === feature.id}
              onclick={() => select_feature(feature)}
            >
              <div class="feature-item-header">
                <span class="feature-name">{feature.title}</span>
                <span class="badge badge-{status_class(feature.status)}">
                  <span class="icon" style="font-size:12px">{status_icon(feature.status)}</span>
                  {feature.status.replace('_', ' ')}
                </span>
              </div>
              <div class="feature-item-meta">
                <span class="icon" style="font-size:12px">task</span> {feature.tasks?.length ?? 0} tasks
                <span class="icon" style="font-size:12px;margin-left:0.5rem">link</span> {feature.resources?.length ?? 0} resources
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="detail-panel">
        {#if selected_feature}
          <div class="detail-top-bar">
            <button class="btn-back-mobile" onclick={() => show_mobile_detail = false}>
              <span class="icon">arrow_back</span>
            </button>
          </div>
          <div class="detail-header">
            <h3>{selected_feature.title}</h3>
            <div class="detail-actions">
              {#if selected_feature.status === 'Draft'}
                <button class="btn btn-primary btn-sm" onclick={() => submit_feature(selected_feature!.id)}>
                  <span class="icon" style="font-size:14px">send</span> Submit
                </button>
              {/if}
              <button class="btn btn-danger btn-sm" onclick={() => delete_feature(selected_feature!.id)}>
                <span class="icon" style="font-size:14px">delete</span>
              </button>
            </div>
          </div>

          <div class="detail-body">
            <div class="detail-section">
              <h4><span class="icon" style="font-size:16px">description</span> Description</h4>
              <div class="description-text">{selected_feature.description ?? 'No description'}</div>
            </div>

            {#if selected_feature.resources && selected_feature.resources.length > 0}
              <div class="detail-section">
                <h4><span class="icon" style="font-size:16px">link</span> Resources</h4>
                <ul class="resource-list">
                  {#each selected_feature.resources as resource}
                    <li>
                      <a href={resource.url} target="_blank" rel="noopener">
                        <span class="icon" style="font-size:14px">open_in_new</span>
                        {resource.title ?? resource.url}
                      </a>
                      <span class="badge badge-{status_class(resource.status)}">
                        <span class="icon" style="font-size:11px">{status_icon(resource.status)}</span>
                        {resource.status}
                      </span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <div class="detail-section">
              <div class="tasks-header">
                <h4><span class="icon" style="font-size:16px">task</span> Tasks ({selected_feature.tasks?.length ?? 0})</h4>
                <div class="tasks-actions">
                  <label class="toggle-label">
                    <input type="checkbox" bind:checked={auto_approve} />
                    Auto-Approve
                  </label>
                  {#if selected_feature.tasks?.some((t: Task) => t.status === 'Pending_Approval')}
                    <button class="btn btn-secondary btn-sm" onclick={() => approve_all(selected_feature!.id)}>
                      <span class="icon" style="font-size:14px">done_all</span> Approve All
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
                        <span class="badge badge-{status_class(task.status)}">
                          <span class="icon" style="font-size:11px">{status_icon(task.status)}</span>
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div class="task-actions">
                        {#if task.status === 'Pending_Approval'}
                          <button class="btn btn-primary btn-sm" onclick={() => approve_task(task.id)}>
                            <span class="icon" style="font-size:14px">thumb_up</span> Approve
                          </button>
                        {/if}
                        {#if task.status === 'Approved'}
                          <button class="btn btn-secondary btn-sm" onclick={() => spawn_ralph(task.id)}>
                            <span class="icon" style="font-size:14px">play_arrow</span> Run Ralph
                          </button>
                        {/if}
                        {#if task.agent_log}
                          <details class="log-details">
                            <summary><span class="icon" style="font-size:14px">terminal</span> View Log</summary>
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
            <span class="icon" style="font-size:48px;color:var(--fg-muted)">touch_app</span>
            <p>Select a feature to view details</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1100px; }
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
  }
  .back-link {
    color: var(--accent); text-decoration: none; font-size: 0.85rem;
    display: inline-flex; align-items: center; gap: 0.25rem;
  }
  .page-header h2 { font-size: 1.5rem; color: var(--fg); margin-top: 0.25rem; }
  .project-desc { color: var(--fg-muted); font-size: 0.9rem; }

  .create-form {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }

  .input {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.6rem 0.8rem; color: var(--fg); font-size: 0.875rem; width: 100%;
    font-family: var(--font);
  }
  .input:focus { outline: none; border-color: var(--accent); }
  .textarea { resize: vertical; font-family: var(--font); }
  .input-title { max-width: 180px; }

  .resources-section { margin-top: 0.5rem; }
  .resources-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--fg-muted);
  }
  .resources-header span { display: inline-flex; align-items: center; gap: 0.3rem; }
  .resource-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; white-space: nowrap; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); }
  .btn-secondary:hover { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: var(--fg); }
  .btn-danger:hover { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .btn-icon { padding: 0.35rem; min-width: 0; }

  .content-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1rem; min-height: 400px; }

  .features-panel {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem;
  }
  .features-panel h3 {
    font-size: 0.95rem; color: var(--fg); margin-bottom: 0.75rem;
    display: flex; align-items: center; gap: 0.4rem;
  }

  .feature-item {
    display: block; width: 100%; text-align: left; background: transparent;
    border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem;
    margin-bottom: 0.5rem; cursor: pointer; color: inherit; transition: all 0.15s;
    font-family: var(--font); font-size: inherit;
  }
  .feature-item:hover { border-color: var(--accent); }
  .feature-item.selected { border-color: var(--accent); background: var(--bg); }

  .feature-item-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .feature-name { font-weight: 600; color: var(--fg); font-size: 0.875rem; }
  .feature-item-meta {
    font-size: 0.7rem; color: var(--fg-muted); margin-top: 0.25rem;
    display: flex; align-items: center;
  }

  .detail-panel {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem;
  }
  .detail-top-bar { display: none; }
  .detail-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 0.5rem;
  }
  .detail-header h3 { font-size: 1.05rem; color: var(--fg); }
  .detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .detail-section { margin-bottom: 1.25rem; }
  .detail-section h4 {
    font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem;
    display: flex; align-items: center; gap: 0.3rem;
  }
  .description-text { font-size: 0.875rem; color: var(--fg); line-height: 1.6; white-space: pre-wrap; }

  .resource-list { list-style: none; }
  .resource-list li {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.4rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 0.5rem;
  }
  .resource-list a {
    color: var(--accent); text-decoration: none; font-size: 0.85rem;
    display: inline-flex; align-items: center; gap: 0.3rem;
  }

  .tasks-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;
  }
  .tasks-header h4 { margin-bottom: 0; }
  .tasks-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .toggle-label {
    display: flex; align-items: center; gap: 0.35rem;
    font-size: 0.8rem; color: var(--fg-muted); cursor: pointer;
  }

  .task-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .task-item {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 0.75rem;
  }
  .task-header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;
  }
  .task-desc { font-size: 0.85rem; color: var(--fg); }
  .task-actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

  .badge {
    font-size: 0.65rem; font-weight: 600; text-transform: uppercase; white-space: nowrap;
    padding: 0.15rem 0.45rem; border-radius: 10px;
    display: inline-flex; align-items: center; gap: 0.2rem;
  }
  .badge-muted { background: var(--bg-elevated); color: var(--fg-muted); }
  .badge-info { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }
  .badge-warn { background: var(--accent-dim); color: var(--accent); }
  .badge-success { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .badge-danger { background: rgba(201, 84, 74, 0.15); color: var(--danger); }

  .empty, .loading {
    color: var(--fg-muted); font-size: 0.85rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
  .empty-detail {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 200px; color: var(--fg-muted); gap: 0.75rem;
  }

  .log-details { width: 100%; }
  .log-details summary {
    cursor: pointer; font-size: 0.8rem; color: var(--accent);
    display: inline-flex; align-items: center; gap: 0.25rem;
  }
  .log-content {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.75rem; font-size: 0.7rem; color: var(--fg-muted);
    max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
    margin-top: 0.5rem; font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .btn-back-mobile {
    display: none; background: none; border: none; color: var(--fg);
    cursor: pointer; padding: 0.25rem;
  }

  @media (max-width: 768px) {
    .content-grid {
      display: flex; flex-direction: column; gap: 0;
    }

    .content-grid .features-panel { display: block; }
    .content-grid .detail-panel { display: none; }

    .content-grid.show-detail .features-panel { display: none; }
    .content-grid.show-detail .detail-panel { display: block; }

    .detail-top-bar { display: block; margin-bottom: 0.75rem; }
    .btn-back-mobile { display: inline-flex; }

    .resource-row { flex-direction: column; }
    .input-title { max-width: 100%; }
  }
</style>

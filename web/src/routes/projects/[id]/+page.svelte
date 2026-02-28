<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import { use_polling } from '$lib/utils/polling.svelte';
  import type { Project, Feature, Task } from '$lib/types';
  import FeatureForm from './FeatureForm.svelte';
  import TaskArtifacts from './TaskArtifacts.svelte';

  let project = $state<Project | null>(null);
  let features = $state<Feature[]>([]);
  let loading = $state(true);
  let auto_approve = $state(false);

  let show_feature_form = $state(false);

  let selected_feature = $state<Feature | null>(null);
  let show_mobile_detail = $state(false);
  let editing_feature = $state(false);
  let edit_title = $state('');
  let edit_description = $state('');
  let edit_model = $state('');
  let edit_cli = $state('copilot');
  let edit_models = $state<{ value: string; label: string }[]>([]);
  let loading_edit_models = $state(false);

  let last_edit_cli = $state('');
  let last_edit_feature_id = $state('');

  async function load_edit_models(cli: string) {
    if (cli === last_edit_cli && selected_feature?.id === last_edit_feature_id) return;
    loading_edit_models = true;
    try {
      edit_models = await api.list_models(cli);
      if (!edit_models.find(m => m.value === edit_model) && edit_models.length > 0) {
        edit_model = edit_models[0].value;
      }
      last_edit_cli = cli;
      last_edit_feature_id = selected_feature?.id ?? '';
    } catch (err) {
      console.error('Failed to load edit models:', err);
      toast_store.error('Failed to load models');
    } finally {
      loading_edit_models = false;
    }
  }

  $effect(() => {
    if (editing_feature) {
      load_edit_models(edit_cli);
    }
  });

  let saving_edit = $state(false);
  let new_resource_url = $state('');
  let new_resource_title = $state('');

  let adding_task = $state(false);
  let new_task_desc = $state('');
  let editing_task_id = $state<string | null>(null);
  let editing_task_desc = $state('');
  let saving_task = $state(false);

  let managing_task_id: string | null = $state(null);

  let selected_feature_ids = $state<Set<string>>(new Set());
  let deleting_features = $state(false);
  let all_features_selected = $derived(features.length > 0 && selected_feature_ids.size === features.length);

  function toggle_feature_select(id: string, event: MouseEvent) {
    event.stopPropagation();
    const next = new Set(selected_feature_ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected_feature_ids = next;
  }

  function toggle_all_features() {
    if (all_features_selected) {
      selected_feature_ids = new Set();
    } else {
      selected_feature_ids = new Set(features.map(f => f.id));
    }
  }

  async function delete_selected_features() {
    if (selected_feature_ids.size === 0) return;
    if (!confirm(`Delete ${selected_feature_ids.size} feature(s)?`)) return;
    deleting_features = true;
    try {
      await Promise.all([...selected_feature_ids].map(id => api.delete_feature(id)));
      if (selected_feature && selected_feature_ids.has(selected_feature.id)) {
        selected_feature = null;
        show_mobile_detail = false;
      }
      selected_feature_ids = new Set();
      await load_data();
    } catch (error) {
      console.error('Failed to delete features:', error);
      toast_store.error('Failed to delete features');
    } finally {
      deleting_features = false;
    }
  }

  const project_id = $derived(page.params.id);

  async function load_data() {
    if (!project_id) return;
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
      toast_store.error('Failed to load project');
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    // Models are now handled by FeatureForm and edit state
  });

  let agent_info = $state<{ processes: any[]; pipeline: any } | null>(null);

  async function load_agent_status() {
    if (!selected_feature) {
      agent_info = null;
      return;
    }
    try {
      agent_info = await api.feature_agent_status(selected_feature.id);
      
      // If manager or ralph is running, refresh tasks more frequently or just once
      const is_running = agent_info.processes.some(p => p.status === 'running') || 
                        (agent_info.pipeline.is_active_feature && agent_info.pipeline.state === 'running');
      
      if (is_running) {
        // Refresh tasks and feature data to see new tasks appearing
        load_data();
      }
    } catch (err) {
      console.error('Failed to load feature agent status:', err);
      toast_store.error('Failed to load feature agent status');
    }
  }

  use_polling(() => {
    load_data();
    if (selected_feature) load_agent_status();
  }, 5000);

  async function create_feature(data: { title: string; description?: string; cli: string; model: string | null; resources: { url: string; title?: string }[] }) {
    try {
      await api.create_feature({
        project_id: project_id,
        title: data.title,
        description: data.description,
        cli: data.cli,
        model: data.model,
        resources: data.resources.length > 0 ? (data.resources as any) : undefined,
      });
      show_feature_form = false;
      await load_data();
    } catch (error) {
      console.error('Failed to create feature:', error);
      toast_store.error('Failed to create feature');
    }
  }

  async function submit_feature(feature_id: string) {
    try {
      await api.submit_feature(feature_id);
      toast_store.success('Feature submitted! AI is analyzing your request…');
      await load_data();
    } catch (error) {
      console.error('Failed to submit feature:', error);
      toast_store.error('Failed to submit feature');
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
      toast_store.error('Failed to delete feature');
    }
  }

  async function approve_task(task_id: string) {
    try {
      await api.approve_task(task_id);
      await load_data();
    } catch (error) {
      console.error('Failed to approve task:', error);
      toast_store.error('Failed to approve task');
    }
  }

  async function approve_all(feature_id: string) {
    try {
      await api.approve_all_tasks(feature_id);
      await load_data();
    } catch (error) {
      console.error('Failed to approve tasks:', error);
      toast_store.error('Failed to approve tasks');
    }
  }

  async function spawn_ralph(task_id: string) {
    try {
      await api.spawn_ralph(task_id);
      await load_data();
    } catch (error) {
      console.error('Failed to spawn ralph:', error);
      toast_store.error('Failed to spawn ralph');
    }
  }

  async function add_task() {
    if (!new_task_desc.trim() || !selected_feature) return;
    saving_task = true;
    try {
      await api.create_task({ feature_id: selected_feature.id, description: new_task_desc.trim() });
      new_task_desc = '';
      adding_task = false;
      await load_data();
    } catch (error) {
      console.error('Failed to add task:', error);
      toast_store.error('Failed to add task');
    } finally {
      saving_task = false;
    }
  }

  function start_task_edit(task: Task) {
    editing_task_id = task.id;
    editing_task_desc = task.description;
  }

  async function save_task_edit() {
    if (!editing_task_id || !editing_task_desc.trim()) return;
    saving_task = true;
    try {
      await api.update_task(editing_task_id, { description: editing_task_desc.trim() });
      editing_task_id = null;
      await load_data();
    } catch (error) {
      console.error('Failed to update task:', error);
      toast_store.error('Failed to update task');
    } finally {
      saving_task = false;
    }
  }

  async function remove_task(task_id: string) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete_task(task_id);
      await load_data();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast_store.error('Failed to delete task');
    }
  }
  function select_feature(feature: Feature) {
    selected_feature = feature;
    show_mobile_detail = true;
    editing_feature = false;
  }

  function start_editing() {
    if (!selected_feature) return;
    edit_title = selected_feature.title;
    edit_description = selected_feature.description ?? '';
    edit_cli = selected_feature.cli ?? 'copilot';
    edit_model = selected_feature.model ?? '';
    editing_feature = true;
  }

  function cancel_editing() {
    editing_feature = false;
  }

  async function save_feature_edit() {
    if (!selected_feature || !edit_title.trim()) return;
    saving_edit = true;
    try {
      await api.update_feature(selected_feature.id, {
        title: edit_title.trim(),
        description: edit_description.trim() || null,
        cli: edit_cli,
        model: edit_model || null,
      } as Partial<Feature>);
      editing_feature = false;
      await load_data();
    } catch (error) {
      console.error('Failed to update feature:', error);
      toast_store.error('Failed to update feature');
    } finally {
      saving_edit = false;
    }
  }

  async function add_resource_to_feature() {
    if (!selected_feature || !new_resource_url.trim()) return;
    try {
      await api.add_resource(selected_feature.id, {
        url: new_resource_url.trim(),
        title: new_resource_title.trim() || undefined,
      });
      new_resource_url = '';
      new_resource_title = '';
      await load_data();
    } catch (error) {
      console.error('Failed to add resource:', error);
      toast_store.error('Failed to add resource');
    }
  }

  async function remove_existing_resource(resource_id: string) {
    if (!selected_feature) return;
    try {
      await api.delete_resource(selected_feature.id, resource_id);
      await load_data();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      toast_store.error('Failed to delete resource');
    }
  }

  function toggle_task_artifacts(task_id: string) {
    managing_task_id = managing_task_id === task_id ? null : task_id;
  }

  function status_icon(status: string): string {
    const map: Record<string, string> = {
      draft: 'edit_note', submitted: 'send', in_progress: 'sync', done: 'check_circle',
      pending_approval: 'pending', approved: 'thumb_up', complete: 'check_circle',
      failed: 'error', skipped: 'skip_next',
      pending: 'hourglass_empty', fetched: 'check', error: 'error',
    };
    return map[status.toLowerCase()] ?? 'help';
  }

  function status_class(status: string): string {
    const map: Record<string, string> = {
      draft: 'muted', submitted: 'info', in_progress: 'warn', done: 'success',
      pending_approval: 'warn', approved: 'info', complete: 'success',
      failed: 'danger', skipped: 'warn',
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
      <FeatureForm on_create={create_feature} on_cancel={() => show_feature_form = false} />
    {/if}

    <div class="content-grid" class:show-detail={show_mobile_detail}>
      <div class="features-panel">
        <div class="features-panel-header">
          <h3><span class="icon" style="font-size:18px">category</span> Features ({features.length})</h3>
          <div class="features-panel-actions">
            {#if features.length > 0}
              <label class="select-all-label">
                <input type="checkbox" checked={all_features_selected} onchange={toggle_all_features} />
                All
              </label>
            {/if}
            {#if selected_feature_ids.size > 0}
              <button class="btn btn-danger btn-sm" onclick={delete_selected_features} disabled={deleting_features}>
                <span class="icon" style="font-size:14px">delete</span> {selected_feature_ids.size}
              </button>
            {/if}
          </div>
        </div>
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
                <div class="feature-name-row">
                  <input type="checkbox" checked={selected_feature_ids.has(feature.id)} onclick={(e: MouseEvent) => toggle_feature_select(feature.id, e)} />
                  <span class="feature-name">{feature.title}</span>
                </div>
                <span class="badge badge-{status_class(feature.status)}">
                  <span class="icon" style="font-size:12px">{status_icon(feature.status)}</span>
                  {feature.status.replace('_', ' ')}
                </span>
              </div>
              <div class="feature-item-meta">
                <span class="icon" style="font-size:12px">task</span> {feature.tasks?.length ?? 0}
                <span class="icon" style="font-size:12px;margin-left:0.5rem">link</span> {feature.resources?.length ?? 0}
                <span class="badge badge-muted" style="margin-left:0.5rem; transform: scale(0.9)">{feature.cli || 'copilot'}</span>
                {#if feature.model}
                  <span class="badge badge-info" style="margin-left:0.25rem; transform: scale(0.9)">{feature.model}</span>
                {/if}
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
            <div style="display:flex; flex-direction:column; gap:0.25rem">
              <h3>{selected_feature.title}</h3>
              {#if agent_info && (agent_info.processes.some(p => p.status === 'running') || (agent_info.pipeline.is_active_feature && agent_info.pipeline.state === 'running'))}
                <div class="agent-running-indicator">
                  <span class="icon spin" style="font-size:12px; color:var(--accent)">progress_activity</span>
                  <span style="font-size:0.65rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em">
                    {agent_info.processes.some(p => p.status === 'running' && p.type === 'manager') ? 'Manager Processing' : 'Ralph Working'}
                  </span>
                </div>
              {/if}
            </div>
            <div class="detail-actions">
              {#if selected_feature.status === 'Draft' && !editing_feature}
                <button class="btn btn-secondary btn-sm" onclick={start_editing}>
                  <span class="icon" style="font-size:14px">edit</span> Edit
                </button>
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
            {#if editing_feature}
              <form class="edit-feature-form" onsubmit={(e) => { e.preventDefault(); save_feature_edit(); }}>
                <label class="edit-label" for="edit-title">Title</label>
                <input id="edit-title" type="text" class="input" bind:value={edit_title} required />
                <label class="edit-label" for="edit-desc">Description</label>
                <textarea id="edit-desc" class="input textarea" bind:value={edit_description} rows={4}></textarea>
                
                <div class="selection-grid">
                  <div class="field">
                    <label class="edit-label" for="edit-cli">CLI Engine</label>
                    <select id="edit-cli" bind:value={edit_cli} class="input select">
                      <option value="copilot">Copilot CLI</option>
                      <option value="gemini">Gemini CLI</option>
                    </select>
                  </div>
                  <div class="field">
                    <label class="edit-label" for="edit-model">Model {loading_edit_models ? '(...)' : ''}</label>
                    <select id="edit-model" bind:value={edit_model} class="input select" disabled={loading_edit_models}>
                      {#each edit_models as m}
                        <option value={m.value}>{m.label}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="form-actions">
                  <button type="button" class="btn btn-secondary btn-sm" onclick={cancel_editing}>Cancel</button>
                  <button type="submit" class="btn btn-primary btn-sm" disabled={saving_edit || !edit_title.trim()}>
                    {saving_edit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            {:else}
            <div class="detail-section">
              <h4><span class="icon" style="font-size:16px">description</span> Description</h4>
              <div class="description-text">{selected_feature.description ?? 'No description'}</div>
            </div>

            <div class="detail-section">
              <h4><span class="icon" style="font-size:16px">smart_toy</span> Engine & Model</h4>
              <div style="display:flex; gap:0.5rem">
                <span class="badge badge-muted">{selected_feature.cli || 'copilot'}</span>
                <span class="badge badge-info">{selected_feature.model || 'Default (auto)'}</span>
              </div>
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
                      <div class="resource-actions">
                        <span class="badge badge-{status_class(resource.status)}">
                          <span class="icon" style="font-size:11px">{status_icon(resource.status)}</span>
                          {resource.status}
                        </span>
                        {#if selected_feature.status === 'Draft'}
                          <button class="btn btn-danger btn-icon" onclick={() => remove_existing_resource(resource.id)} title="Remove resource">
                            <span class="icon" style="font-size:14px">close</span>
                          </button>
                        {/if}
                      </div>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if selected_feature.status === 'Draft'}
              <div class="detail-section">
                <h4><span class="icon" style="font-size:16px">add_link</span> Add Resource</h4>
                <div class="add-resource-row">
                  <input type="url" placeholder="https://..." bind:value={new_resource_url} class="input" />
                  <input type="text" placeholder="Title" bind:value={new_resource_title} class="input input-title" />
                  <button class="btn btn-primary btn-sm" onclick={add_resource_to_feature} disabled={!new_resource_url.trim()}>
                    <span class="icon" style="font-size:14px">add</span> Add
                  </button>
                </div>
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
                  <button class="btn btn-secondary btn-sm" onclick={() => { adding_task = true; new_task_desc = ''; }}>
                    <span class="icon" style="font-size:14px">add</span> Add Task
                  </button>
                </div>
              </div>

              {#if adding_task}
                <div class="task-add-form">
                  <input
                    class="task-input"
                    type="text"
                    placeholder="Task description…"
                    bind:value={new_task_desc}
                    onkeydown={(e) => { if (e.key === 'Enter') add_task(); if (e.key === 'Escape') adding_task = false; }}
                  />
                  <div class="task-add-actions">
                    <button class="btn btn-primary btn-sm" onclick={add_task} disabled={saving_task || !new_task_desc.trim()}>Save</button>
                    <button class="btn btn-secondary btn-sm" onclick={() => adding_task = false}>Cancel</button>
                  </div>
                </div>
              {/if}

              {#if !selected_feature.tasks || selected_feature.tasks.length === 0}
                <p class="empty">No tasks yet. Submit the feature to generate tasks via Manager agent.</p>
              {:else}
                <div class="task-list">
                  {#each selected_feature.tasks as task}
                    <div class="task-item">
                      {#if editing_task_id === task.id}
                        <div class="task-edit-form">
                          <input
                            class="task-input"
                            type="text"
                            bind:value={editing_task_desc}
                            onkeydown={(e) => { if (e.key === 'Enter') save_task_edit(); if (e.key === 'Escape') editing_task_id = null; }}
                          />
                          <div class="task-add-actions">
                            <button class="btn btn-primary btn-sm" onclick={save_task_edit} disabled={saving_task}>Save</button>
                            <button class="btn btn-secondary btn-sm" onclick={() => editing_task_id = null}>Cancel</button>
                          </div>
                        </div>
                      {:else}
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
                          {#if ['Pending_Approval', 'Approved'].includes(task.status)}
                            <button class="btn btn-icon btn-sm" title="Edit" onclick={() => start_task_edit(task)}>
                              <span class="icon" style="font-size:14px">edit</span>
                            </button>
                            <button class="btn btn-danger btn-sm" title="Delete" onclick={() => remove_task(task.id)}>
                              <span class="icon" style="font-size:14px">delete</span>
                            </button>
                          {/if}
                          {#if task.agent_log}
                            <details class="log-details">
                              <summary><span class="icon" style="font-size:14px">terminal</span> View Log</summary>
                              <pre class="log-content">{task.agent_log}</pre>
                            </details>
                          {/if}
                          <button class="btn btn-secondary btn-sm" title="Artifacts" onclick={() => toggle_task_artifacts(task.id)}>
                            <span class="icon" style="font-size:14px">tune</span> Artifacts
                          </button>
                        </div>
                        {#if managing_task_id === task.id}
                          <TaskArtifacts task_id={task.id} />
                        {/if}
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
            {/if}
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

  .input {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.6rem 0.8rem; color: var(--fg); font-size: 0.875rem; width: 100%;
    font-family: var(--font);
  }
  .input:focus { outline: none; border-color: var(--accent); }
  .textarea { resize: vertical; font-family: var(--font); }
  .input-title { max-width: 180px; }

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
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .btn-icon { padding: 0.35rem; min-width: 0; }

  .content-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1rem; min-height: 400px; }

  .features-panel {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem;
  }
  .features-panel h3 {
    font-size: 0.95rem; color: var(--fg); margin-bottom: 0;
    display: flex; align-items: center; gap: 0.4rem;
  }

  .features-panel-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;
  }

  .features-panel-actions {
    display: flex; align-items: center; gap: 0.5rem;
  }

  .select-all-label {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.75rem; color: var(--fg-muted); cursor: pointer;
  }

  .feature-name-row {
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
  .detail-header h3 { font-size: 1.25rem; color: var(--fg); }
  .agent-running-indicator {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.15rem 0.5rem; background: rgba(212, 175, 55, 0.1);
    border-radius: 4px; border: 1px solid rgba(212, 175, 55, 0.2);
  }

  .detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .detail-section { margin-bottom: 1.25rem; }
  .detail-section h4 {
    font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem;
    display: flex; align-items: center; gap: 0.3rem;
  }
  .description-text { font-size: 0.875rem; color: var(--fg); line-height: 1.6; white-space: pre-wrap; }

  .resource-actions {
    display: flex; align-items: center; gap: 0.35rem;
  }

  .add-resource-row {
    display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
  }

  .edit-feature-form {
    display: flex; flex-direction: column; gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .edit-label {
    font-size: 0.8rem; color: var(--fg-muted); font-weight: 600;
  }

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

  .task-add-form, .task-edit-form {
    display: flex; flex-direction: column; gap: 0.5rem;
    background: var(--bg); border: 1px solid var(--accent);
    border-radius: var(--radius); padding: 0.75rem; margin-bottom: 0.5rem;
  }
  .task-input {
    width: 100%; padding: 0.4rem 0.6rem;
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--fg); font-size: 0.85rem;
    font-family: var(--font); outline: none; transition: border-color 0.15s;
  }
  .task-input:focus { border-color: var(--accent); }
  .task-add-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

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

  .select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.6rem center;
    padding-right: 2rem;
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

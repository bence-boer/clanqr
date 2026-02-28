<script lang="ts">
  import type { Feature, AgentRun, PipelineStatus } from '$lib/types';
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import TaskList from './TaskList.svelte';

  interface Props {
    feature: Feature;
    agent_info: { processes: AgentRun[]; pipeline: PipelineStatus } | null;
    on_submit: (feature_id: string) => Promise<void>;
    on_delete: (feature_id: string) => Promise<void>;
    on_update: () => Promise<void>;
    on_back: () => void;
  }

  let { feature, agent_info, on_submit, on_delete, on_update, on_back }: Props = $props();

  let editing = $state(false);
  let edit_title = $state('');
  let edit_description = $state('');
  let edit_model = $state('');
  let edit_cli = $state('copilot');
  let edit_models = $state<{ value: string; label: string }[]>([]);
  let loading_edit_models = $state(false);
  let saving_edit = $state(false);

  let new_resource_url = $state('');
  let new_resource_title = $state('');

  let last_edit_cli = $state('');
  let last_edit_feature_id = $state('');

  async function load_edit_models(cli: string) {
    if (cli === last_edit_cli && feature.id === last_edit_feature_id) return;
    loading_edit_models = true;
    try {
      edit_models = await api.list_models(cli);
      if (!edit_models.find(m => m.value === edit_model) && edit_models.length > 0) {
        edit_model = edit_models[0].value;
      }
      last_edit_cli = cli;
      last_edit_feature_id = feature.id;
    } catch (err) {
      console.error('Failed to load edit models:', err);
      toast_store.error('Failed to load models');
    } finally {
      loading_edit_models = false;
    }
  }

  $effect(() => {
    if (editing) {
      load_edit_models(edit_cli);
    }
  });

  function start_editing() {
    edit_title = feature.title;
    edit_description = feature.description ?? '';
    edit_cli = feature.cli ?? 'copilot';
    edit_model = feature.model ?? '';
    editing = true;
  }

  function cancel_editing() {
    editing = false;
  }

  async function save_edit() {
    if (!edit_title.trim()) return;
    saving_edit = true;
    try {
      await api.update_feature(feature.id, {
        title: edit_title.trim(),
        description: edit_description.trim() || null,
        cli: edit_cli,
        model: edit_model || null,
      } as Partial<Feature>);
      editing = false;
      await on_update();
    } catch (error) {
      console.error('Failed to update feature:', error);
      toast_store.error('Failed to update feature');
    } finally {
      saving_edit = false;
    }
  }

  async function add_resource() {
    if (!new_resource_url.trim()) return;
    try {
      await api.add_resource(feature.id, {
        url: new_resource_url.trim(),
        title: new_resource_title.trim() || undefined,
      });
      new_resource_url = '';
      new_resource_title = '';
      await on_update();
    } catch (error) {
      console.error('Failed to add resource:', error);
      toast_store.error('Failed to add resource');
    }
  }

  async function remove_resource(resource_id: string) {
    try {
      await api.delete_resource(feature.id, resource_id);
      await on_update();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      toast_store.error('Failed to delete resource');
    }
  }

  async function handle_approve(task_id: string) {
    try {
      await api.approve_task(task_id);
      await on_update();
    } catch (error) {
      console.error('Failed to approve task:', error);
      toast_store.error('Failed to approve task');
    }
  }

  async function handle_approve_all(feature_id: string) {
    try {
      await api.approve_all_tasks(feature_id);
      await on_update();
    } catch (error) {
      console.error('Failed to approve tasks:', error);
      toast_store.error('Failed to approve tasks');
    }
  }

  async function handle_spawn(task_id: string) {
    try {
      await api.spawn_ralph(task_id);
      await on_update();
    } catch (error) {
      console.error('Failed to spawn ralph:', error);
      toast_store.error('Failed to spawn ralph');
    }
  }

  async function handle_add_task(description: string) {
    try {
      await api.create_task({ feature_id: feature.id, description });
      await on_update();
    } catch (error) {
      console.error('Failed to add task:', error);
      toast_store.error('Failed to add task');
    }
  }

  async function handle_update_task(task_id: string, description: string) {
    try {
      await api.update_task(task_id, { description });
      await on_update();
    } catch (error) {
      console.error('Failed to update task:', error);
      toast_store.error('Failed to update task');
    }
  }

  async function handle_delete_task(task_id: string) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete_task(task_id);
      await on_update();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast_store.error('Failed to delete task');
    }
  }

  async function handle_toggle_auto_approve(enabled: boolean) {
    try {
      await api.update_feature(feature.id, { auto_approve: enabled } as Partial<Feature>);
      await on_update();
    } catch (error) {
      console.error('Failed to update auto-approve:', error);
      toast_store.error('Failed to update auto-approve');
    }
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

<div class="detail-top-bar">
  <button class="btn-back-mobile" onclick={on_back}>
    <span class="icon">arrow_back</span>
  </button>
</div>
<div class="detail-header">
  <div style="display:flex; flex-direction:column; gap:0.25rem">
    <h3>{feature.title}</h3>
    {#if agent_info && (agent_info.processes.some(p => p.status === 'running') || ((agent_info.pipeline as any).is_active_feature && agent_info.pipeline.state === 'running'))}
      <div class="agent-running-indicator">
        <span class="icon spin" style="font-size:12px; color:var(--accent)">progress_activity</span>
        <span style="font-size:0.65rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em">
          {agent_info.processes.some(p => p.status === 'running' && p.type === 'manager') ? 'Manager Processing' : 'Ralph Working'}
        </span>
      </div>
    {/if}
  </div>
  <div class="detail-actions">
    {#if feature.status === 'Draft' && !editing}
      <button class="btn btn-secondary btn-sm" onclick={start_editing}>
        <span class="icon" style="font-size:14px">edit</span> Edit
      </button>
      <button class="btn btn-primary btn-sm" onclick={() => on_submit(feature.id)}>
        <span class="icon" style="font-size:14px">send</span> Submit
      </button>
    {/if}
    <button class="btn btn-danger btn-sm" onclick={() => on_delete(feature.id)}>
      <span class="icon" style="font-size:14px">delete</span>
    </button>
  </div>
</div>

{#if feature.last_error}
  <div class="error-banner">
    <span class="icon" style="font-size:14px">error</span> {feature.last_error}
    {#if feature.manager_retry_count > 0}
      (retry {feature.manager_retry_count}/3)
    {/if}
  </div>
{/if}

<div class="detail-body">
  {#if editing}
    <form class="edit-feature-form" onsubmit={(e) => { e.preventDefault(); save_edit(); }}>
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
    <div class="description-text">{feature.description ?? 'No description'}</div>
  </div>

  <div class="detail-section">
    <h4><span class="icon" style="font-size:16px">smart_toy</span> Engine & Model</h4>
    <div style="display:flex; gap:0.5rem">
      <span class="badge badge-muted">{feature.cli || 'copilot'}</span>
      <span class="badge badge-info">{feature.model || 'Default (auto)'}</span>
    </div>
  </div>

  {#if feature.resources && feature.resources.length > 0}
    <div class="detail-section">
      <h4><span class="icon" style="font-size:16px">link</span> Resources</h4>
      <ul class="resource-list">
        {#each feature.resources as resource}
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
              {#if feature.status === 'Draft'}
                <button class="btn btn-danger btn-icon" onclick={() => remove_resource(resource.id)} title="Remove resource">
                  <span class="icon" style="font-size:14px">close</span>
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if feature.status === 'Draft'}
    <div class="detail-section">
      <h4><span class="icon" style="font-size:16px">add_link</span> Add Resource</h4>
      <div class="add-resource-row">
        <input type="url" placeholder="https://..." bind:value={new_resource_url} class="input" />
        <input type="text" placeholder="Title" bind:value={new_resource_title} class="input input-title" />
        <button class="btn btn-primary btn-sm" onclick={add_resource} disabled={!new_resource_url.trim()}>
          <span class="icon" style="font-size:14px">add</span> Add
        </button>
      </div>
    </div>
  {/if}

  <TaskList
    {feature}
    on_approve={handle_approve}
    on_approve_all={handle_approve_all}
    on_spawn={handle_spawn}
    on_add={handle_add_task}
    on_update={handle_update_task}
    on_delete={handle_delete_task}
    on_toggle_auto_approve={handle_toggle_auto_approve}
  />
  {/if}
</div>

<style>
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
  .error-banner {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.6rem 0.8rem; margin-bottom: 1rem;
    background: rgba(201, 84, 74, 0.1); border: 1px solid rgba(201, 84, 74, 0.3);
    border-radius: var(--radius); color: var(--danger); font-size: 0.85rem;
  }
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
  .input {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.6rem 0.8rem; color: var(--fg); font-size: 0.875rem; width: 100%;
    font-family: var(--font);
  }
  .input:focus { outline: none; border-color: var(--accent); }
  .textarea { resize: vertical; font-family: var(--font); }
  .input-title { max-width: 180px; }
  .edit-feature-form {
    display: flex; flex-direction: column; gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .edit-label {
    font-size: 0.8rem; color: var(--fg-muted); font-weight: 600;
  }
  .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .field { display: flex; flex-direction: column; gap: 0.35rem; }
  .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .resource-list { list-style: none; }
  .resource-list li {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.4rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 0.5rem;
  }
  .resource-list a {
    color: var(--accent); text-decoration: none; font-size: 0.85rem;
    display: inline-flex; align-items: center; gap: 0.3rem;
  }
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
  .select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.6rem center;
    padding-right: 2rem;
  }
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
  .btn-back-mobile {
    display: none; background: none; border: none; color: var(--fg);
    cursor: pointer; padding: 0.25rem;
  }
  @media (max-width: 768px) {
    .detail-top-bar { display: block; margin-bottom: 0.75rem; }
    .btn-back-mobile { display: inline-flex; }
    .input-title { max-width: 100%; }
    .selection-grid { grid-template-columns: 1fr; }
  }
</style>

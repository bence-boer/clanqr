<script lang="ts">
  import type { Feature, Task } from '$lib/types';
  import { api } from '$lib/api/client';
  import { toast_store } from '$lib/stores/toast.svelte';
  import TaskArtifacts from './TaskArtifacts.svelte';

  interface Props {
    feature: Feature;
    on_approve: (task_id: string) => Promise<void>;
    on_approve_all: (feature_id: string) => Promise<void>;
    on_spawn: (task_id: string) => Promise<void>;
    on_add: (description: string) => Promise<void>;
    on_update: (task_id: string, description: string) => Promise<void>;
    on_delete: (task_id: string) => Promise<void>;
    on_toggle_auto_approve: (enabled: boolean) => Promise<void>;
  }

  let { feature, on_approve, on_approve_all, on_spawn, on_add, on_update, on_delete, on_toggle_auto_approve }: Props = $props();

  let adding_task = $state(false);
  let new_task_desc = $state('');
  let editing_task_id = $state<string | null>(null);
  let editing_task_desc = $state('');
  let saving_task = $state(false);
  let managing_task_id: string | null = $state(null);
  let auto_approve = $state(false);

  async function handle_add() {
    if (!new_task_desc.trim()) return;
    saving_task = true;
    try {
      await on_add(new_task_desc.trim());
      new_task_desc = '';
      adding_task = false;
    } finally {
      saving_task = false;
    }
  }

  function start_edit(task: Task) {
    editing_task_id = task.id;
    editing_task_desc = task.description;
  }

  async function save_edit() {
    if (!editing_task_id || !editing_task_desc.trim()) return;
    saving_task = true;
    try {
      await on_update(editing_task_id, editing_task_desc.trim());
      editing_task_id = null;
    } finally {
      saving_task = false;
    }
  }

  function toggle_artifacts(task_id: string) {
    managing_task_id = managing_task_id === task_id ? null : task_id;
  }

  async function handle_auto_approve_change() {
    auto_approve = !auto_approve;
    await on_toggle_auto_approve(auto_approve);
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

<div class="detail-section">
  <div class="tasks-header">
    <h4><span class="icon" style="font-size:16px">task</span> Tasks ({feature.tasks?.length ?? 0})</h4>
    <div class="tasks-actions">
      <label class="toggle-label">
        <input type="checkbox" checked={auto_approve} onchange={handle_auto_approve_change} />
        Auto-Approve
      </label>
      {#if feature.tasks?.some((t: Task) => t.status === 'Pending_Approval')}
        <button class="btn btn-secondary btn-sm" onclick={() => on_approve_all(feature.id)}>
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
        onkeydown={(e) => { if (e.key === 'Enter') handle_add(); if (e.key === 'Escape') adding_task = false; }}
      />
      <div class="task-add-actions">
        <button class="btn btn-primary btn-sm" onclick={handle_add} disabled={saving_task || !new_task_desc.trim()}>Save</button>
        <button class="btn btn-secondary btn-sm" onclick={() => adding_task = false}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if !feature.tasks || feature.tasks.length === 0}
    <p class="empty">No tasks yet. Submit the feature to generate tasks via Manager agent.</p>
  {:else}
    <div class="task-list">
      {#each feature.tasks as task}
        <div class="task-item">
          {#if editing_task_id === task.id}
            <div class="task-edit-form">
              <input
                class="task-input"
                type="text"
                bind:value={editing_task_desc}
                onkeydown={(e) => { if (e.key === 'Enter') save_edit(); if (e.key === 'Escape') editing_task_id = null; }}
              />
              <div class="task-add-actions">
                <button class="btn btn-primary btn-sm" onclick={save_edit} disabled={saving_task}>Save</button>
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
                <button class="btn btn-primary btn-sm" onclick={() => on_approve(task.id)}>
                  <span class="icon" style="font-size:14px">thumb_up</span> Approve
                </button>
              {/if}
              {#if task.status === 'Approved'}
                <button class="btn btn-secondary btn-sm" onclick={() => on_spawn(task.id)}>
                  <span class="icon" style="font-size:14px">play_arrow</span> Run Ralph
                </button>
              {/if}
              {#if ['Pending_Approval', 'Approved'].includes(task.status)}
                <button class="btn btn-icon btn-sm" title="Edit" onclick={() => start_edit(task)}>
                  <span class="icon" style="font-size:14px">edit</span>
                </button>
                <button class="btn btn-danger btn-sm" title="Delete" onclick={() => on_delete(task.id)}>
                  <span class="icon" style="font-size:14px">delete</span>
                </button>
              {/if}
              {#if task.agent_log}
                <details class="log-details">
                  <summary><span class="icon" style="font-size:14px">terminal</span> View Log</summary>
                  <pre class="log-content">{task.agent_log}</pre>
                </details>
              {/if}
              <button class="btn btn-secondary btn-sm" title="Artifacts" onclick={() => toggle_artifacts(task.id)}>
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

<style>
  .detail-section { margin-bottom: 1.25rem; }
  .detail-section h4 {
    font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem;
    display: flex; align-items: center; gap: 0.3rem;
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
  .empty {
    color: var(--fg-muted); font-size: 0.85rem;
    display: flex; align-items: center; gap: 0.5rem;
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
</style>

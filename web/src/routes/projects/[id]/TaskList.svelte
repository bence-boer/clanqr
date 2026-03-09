<script lang="ts">
    import { Button, Input } from '$lib/components/primitives';
    import { EmptyState } from '$lib/components';
    import type { Feature, TaskRow } from '$lib/types';
    import TaskItem from './TaskItem.svelte';

    interface Props {
        feature: Feature
        on_approve: (task_id: string) => Promise<void>
        on_approve_all: (feature_id: string) => Promise<void>
        on_spawn: (task_id: string) => Promise<void>
        on_add: (description: string) => Promise<void>
        on_update: (task_id: string, description: string, model?: string | null, title?: string | null) => Promise<void>
        on_delete: (task_id: string) => Promise<void>
        on_toggle_auto_approve: (enabled: boolean) => Promise<void>
    }

    let { feature, on_approve, on_approve_all, on_spawn, on_add, on_update, on_delete, on_toggle_auto_approve }: Props = $props();

    let adding_task = $state(false);
    let new_task_desc = $state('');
    let editing_task_id = $state<string | null>(null);
    let editing_task_title = $state('');
    let editing_task_desc = $state('');
    let editing_task_model = $state<string | null>(null);
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
        }
        finally {
            saving_task = false;
        }
    }

    function start_edit(task: TaskRow) {
        editing_task_id = task.id;
        editing_task_title = task.title || '';
        editing_task_desc = task.description;
        editing_task_model = task.model;
    }

    async function save_edit() {
        if (!editing_task_id || !editing_task_desc.trim()) return;
        saving_task = true;
        try {
            await on_update(editing_task_id, editing_task_desc.trim(), editing_task_model, editing_task_title.trim() || null);
            editing_task_id = null;
        }
        finally {
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
</script>

<div class="detail-section">
    <div class="tasks-header">
        <h4><span class="icon" style="font-size:16px">task</span> Tasks ({feature.tasks?.length ?? 0})</h4>
        <div class="tasks-actions">
            <label class="toggle-label">
                <input type="checkbox" checked={auto_approve} onchange={handle_auto_approve_change} /> Auto-Approve
            </label>
            {#if feature.tasks?.some((t: TaskRow) => t.status === 'Pending_Approval')}
                <Button variant="secondary" size="sm" icon="done_all" onclick={() => on_approve_all(feature.id)}>Approve All</Button>
            {/if}
            <Button variant="secondary" size="sm" icon="add" onclick={() => {
                adding_task = true;
                new_task_desc = '';
            }}>Add Task</Button>
        </div>
    </div>

    {#if adding_task}
        <div class="task-add-form">
            <Input
                class="task-input"
                type="text"
                placeholder="Task description…"
                bind:value={new_task_desc}
                onkeydown={(event) => {
                    if (event.key === 'Enter') handle_add();
                    if (event.key === 'Escape') adding_task = false;
                }}
            />
            <div class="task-add-actions">
                <Button variant="primary" size="sm" onclick={handle_add} disabled={saving_task || !new_task_desc.trim()}>Save</Button>
                <Button variant="secondary" size="sm" onclick={() => (adding_task = false)}>Cancel</Button>
            </div>
        </div>
    {/if}

    {#if !feature.tasks || feature.tasks.length === 0}
        <EmptyState icon="task" message="No tasks yet." detail="Submit the feature to generate tasks via Manager agent." />
    {:else}
        <div class="task-list">
            {#each feature.tasks as task (task.id)}
                <TaskItem
                    {task}
                    feature_cli={feature.execution_cli || feature.cli || 'copilot'}
                    editing={editing_task_id === task.id}
                    bind:editing_title={editing_task_title}
                    bind:editing_desc={editing_task_desc}
                    bind:editing_model={editing_task_model}
                    saving={saving_task}
                    {on_approve}
                    {on_spawn}
                    on_start_edit={start_edit}
                    on_save_edit={save_edit}
                    on_cancel_edit={() => (editing_task_id = null)}
                    {on_delete}
                    on_toggle_artifacts={toggle_artifacts}
                    show_artifacts={managing_task_id === task.id}
                />
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
    .task-add-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: var(--bg); border: 1px solid var(--accent);
        border-radius: var(--radius); padding: 0.75rem; margin-bottom: 0.5rem;
    }
    .task-add-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>

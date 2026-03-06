<script lang="ts">
    import { api } from '$lib/api/client';
    import { Badge, Button, Input, Select } from '$lib/components/primitives';
    import { CodeBlock } from '$lib/components';
    import type { Task } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';
    import TaskArtifacts from './TaskArtifacts.svelte';

    interface Props {
        task: Task
        feature_cli: string
        editing: boolean
        editing_desc: string
        editing_model: string | null
        saving: boolean
        on_approve: (task_id: string) => Promise<void>
        on_spawn: (task_id: string) => Promise<void>
        on_start_edit: (task: Task) => void
        on_save_edit: () => Promise<void>
        on_cancel_edit: () => void
        on_delete: (task_id: string) => Promise<void>
        on_toggle_artifacts: (task_id: string) => void
        show_artifacts: boolean
    }

    let {
        task, feature_cli, editing, editing_desc = $bindable(), editing_model = $bindable(), saving,
        on_approve, on_spawn, on_start_edit, on_save_edit,
        on_cancel_edit, on_delete, on_toggle_artifacts, show_artifacts
    }: Props = $props();

    let model_options = $state<{ value: string, label: string }[]>([]);
    let loading_models = $state(false);
    let last_loaded_cli = $state('');

    async function load_models() {
        if (feature_cli === last_loaded_cli) return;
        loading_models = true;
        try {
            model_options = await api.list_models(feature_cli);
            last_loaded_cli = feature_cli;
        }
        catch {
            model_options = [];
        }
        finally {
            loading_models = false;
        }
    }

    $effect(() => {
        if (editing) load_models();
    });
</script>

<div class="task-item">
    {#if editing}
        <div class="task-edit-form">
            <Input
                class="task-input"
                type="text"
                bind:value={editing_desc}
                onkeydown={(event) => {
                    if (event.key === 'Enter') on_save_edit();
                    if (event.key === 'Escape') on_cancel_edit();
                }}
            />
            <div class="task-model-field">
                <Select id="task-model-{task.id}" label={`Model Override ${loading_models ? '(...)' : ''}`} bind:value={editing_model} class="input select" disabled={loading_models}>
                    <option value={null}>Feature default</option>
                    {#each model_options as m (m.value)}
                        <option value={m.value}>{m.label}</option>
                    {/each}
                </Select>
            </div>
            <div class="task-edit-actions">
                <Button variant="primary" size="sm" onclick={on_save_edit} disabled={saving}>Save</Button>
                <Button variant="secondary" size="sm" onclick={on_cancel_edit}>Cancel</Button>
            </div>
        </div>
    {:else}
        <div class="task-header">
            <span class="task-desc">{task.description}</span>
            <div class="task-badges">
                {#if task.model}
                    <Badge variant="info" style="transform: scale(0.85)">{task.model}</Badge>
                {/if}
                <Badge variant={status_class(task.status) as 'success' | 'danger' | 'muted' | 'info' | 'warning'} icon={status_icon(task.status)}>
                    {task.status.replace(/_/g, ' ')}
                </Badge>
            </div>
        </div>
        <div class="task-actions">
            {#if task.status === 'Pending_Approval'}
                <Button variant="primary" size="sm" icon="thumb_up" onclick={() => on_approve(task.id)}>Approve</Button>
            {/if}
            {#if task.status === 'Approved'}
                <Button variant="secondary" size="sm" icon="play_arrow" onclick={() => on_spawn(task.id)}>Run Ralph</Button>
            {/if}
            {#if ['Pending_Approval', 'Approved'].includes(task.status)}
                <Button variant="ghost" size="sm" icon="edit" title="Edit" onclick={() => on_start_edit(task)} />
                <Button variant="danger" size="sm" icon="delete" title="Delete" onclick={() => on_delete(task.id)} />
            {/if}
            {#if task.agent_log}
                <details class="log-details">
                    <summary><span class="icon" style="font-size:14px">terminal</span> View Log</summary>
                    <CodeBlock content={task.agent_log} max_height="300px" />
                </details>
            {/if}
            <Button variant="secondary" size="sm" icon="tune" title="Artifacts" onclick={() => on_toggle_artifacts(task.id)}>Artifacts</Button>
        </div>
        {#if show_artifacts}
            <TaskArtifacts task_id={task.id} />
        {/if}
    {/if}
</div>

<style>
    .task-item {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
    }
    .task-header {
        display: flex; justify-content: space-between;
        align-items: flex-start; gap: 0.5rem;
    }
    .task-badges { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
    .task-desc { font-size: 0.85rem; color: var(--fg); }
    .task-actions {
        margin-top: 0.5rem; display: flex;
        gap: 0.5rem; align-items: center; flex-wrap: wrap;
    }
    .task-edit-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: var(--bg); border: 1px solid var(--accent);
        border-radius: var(--radius); padding: 0.75rem;
    }
    .task-model-field { max-width: 300px; }
    .task-edit-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .log-details { width: 100%; }
    .log-details summary {
        cursor: pointer; font-size: 0.8rem; color: var(--accent);
        display: inline-flex; align-items: center; gap: 0.25rem;
    }
</style>

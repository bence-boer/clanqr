<script lang="ts">
    import { Accordion } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { TaskRow as Task } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';
    import TaskArtifacts from './TaskArtifacts.svelte';
    import TaskEditForm from './TaskEditForm.svelte';
    import TaskFiles from './TaskFiles.svelte';

    interface Props {
        task: Task
        auto_approve: boolean
        editing: boolean
        editing_title: string
        editing_desc: string
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
        task, auto_approve, editing, editing_title = $bindable(), editing_desc = $bindable(),
        editing_model = $bindable(), saving, on_approve, on_spawn, on_start_edit, on_save_edit,
        on_cancel_edit, on_delete, on_toggle_artifacts, show_artifacts
    }: Props = $props();

    let optimistic_status = $state<string | null>(null);
    const display_status = $derived(optimistic_status ?? task.status);

    async function handle_approve() {
        const prev_status = task.status;
        optimistic_status = 'approved';
        try {
            await on_approve(task.id);
            toast_store.info('Task approved. It will run when the pipeline reaches it.');
        }
        catch {
            optimistic_status = prev_status;
            toast_store.error('Failed to approve task.');
        }
        finally {
            optimistic_status = null;
        }
    }

    function get_task_title(task: Task): string {
        if (task.title) return task.title;
        return task.description.length > 80 ? `${task.description.slice(0, 80)}...` : task.description;
    }
</script>

<div class="task-item">
    {#if editing}
        <TaskEditForm
            task_id={task.id}
            bind:title={editing_title}
            bind:description={editing_desc}
            {saving}
            on_save={on_save_edit}
            on_cancel={on_cancel_edit}
        />
    {:else}
        <div class="task-header">
            <div class="task-info">
                <span class="task-title">{get_task_title(task)}</span>
            </div>
            <div class="task-badges">
                <Badge variant={status_class(display_status) as 'success' | 'danger' | 'muted' | 'info' | 'warning'} icon={status_icon(display_status)}>
                    {display_status.replace(/_/g, ' ')}
                </Badge>
            </div>
        </div>
        {#if task.status === 'failed' && task.output}
            <div class="task-failure-reason">
                <span class="icon" style="font-size:12px">error</span>
                {task.output.length > 120 ? `${task.output.slice(0, 120)}…` : task.output}
            </div>
        {/if}
        <div class="task-actions">
            {#if task.status === 'queued' && !auto_approve}
                <Button variant="primary" size="sm" icon="thumb_up" onclick={handle_approve}>Approve</Button>
            {/if}
            {#if task.status === 'approved'}
                <Button variant="secondary" size="sm" icon="play_arrow" onclick={() => on_spawn(task.id)}>Run Ralph</Button>
            {/if}
            {#if ['queued', 'approved'].includes(task.status)}
                <Button variant="ghost" size="sm" icon="edit" title="Edit" onclick={() => on_start_edit(task)} />
                <Button variant="danger" size="sm" icon="delete" title="Delete" onclick={() => on_delete(task.id)} />
            {/if}
            <Button variant="secondary" size="sm" icon="tune" title="Artifacts" onclick={() => on_toggle_artifacts(task.id)}>Artifacts</Button>
        </div>
        <div class="task-accordion">
            <Accordion label={task.title ? 'Detailed prompt' : 'Task prompt'}>
                <div class="task-prompt">{task.description}</div>
            </Accordion>
        </div>
        {#if task.output}
            <div class="task-accordion">
                <Accordion label="Output">
                    <div class="task-prompt">{task.output}</div>
                </Accordion>
            </div>
        {/if}
        {#if task.status === 'complete' || task.status === 'failed'}
            <TaskFiles task_id={task.id} />
        {/if}
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
    .task-info { flex: 1; min-width: 0; }
    .task-title { font-size: 0.9rem; font-weight: 600; color: var(--fg); display: block; line-height: 1.4; }
    .task-badges { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
    .task-actions {
        margin-top: 0.5rem; display: flex;
        gap: 0.5rem; align-items: center; flex-wrap: wrap;
    }
    .task-accordion { margin-top: 0.6rem; }
    .task-prompt {
        font-size: 0.85rem;
        color: var(--fg-muted);
        line-height: 1.55;
        white-space: pre-wrap;
    }
    .task-failure-reason {
        display: flex; align-items: flex-start; gap: 0.3rem;
        margin-top: 0.35rem; padding: 0.3rem 0.5rem;
        border-radius: var(--radius); background: rgba(239, 68, 68, 0.08);
        color: #ef4444; font-size: 0.75rem; line-height: 1.4;
    }
</style>

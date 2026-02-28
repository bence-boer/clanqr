<script lang="ts">
    import { Badge, Button, Input } from '$lib/components/primitives';
    import { CodeBlock, EmptyState } from '$lib/components';
    import type { Feature, Task } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';
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
                <Button variant="secondary" size="sm" icon="done_all" onclick={() => on_approve_all(feature.id)}>Approve All</Button>
            {/if}
            <Button
                variant="secondary"
                size="sm"
                icon="add"
                onclick={() => {
                    adding_task = true;
                    new_task_desc = '';
                }}
            >
                Add Task
            </Button>
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
            {#each feature.tasks as task}
                <div class="task-item">
                    {#if editing_task_id === task.id}
                        <div class="task-edit-form">
                            <Input
                                class="task-input"
                                type="text"
                                bind:value={editing_task_desc}
                                onkeydown={(event) => {
                                    if (event.key === 'Enter') save_edit();
                                    if (event.key === 'Escape') editing_task_id = null;
                                }}
                            />
                            <div class="task-add-actions">
                                <Button variant="primary" size="sm" onclick={save_edit} disabled={saving_task}>Save</Button>
                                <Button variant="secondary" size="sm" onclick={() => (editing_task_id = null)}>Cancel</Button>
                            </div>
                        </div>
                    {:else}
                        <div class="task-header">
                            <span class="task-desc">{task.description}</span>
                            <Badge variant={status_class(task.status) as any} icon={status_icon(task.status)}>
                                {task.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                        <div class="task-actions">
                            {#if task.status === 'Pending_Approval'}
                                <Button variant="primary" size="sm" icon="thumb_up" onclick={() => on_approve(task.id)}>Approve</Button>
                            {/if}
                            {#if task.status === 'Approved'}
                                <Button variant="secondary" size="sm" icon="play_arrow" onclick={() => on_spawn(task.id)}>Run Ralph</Button>
                            {/if}
                            {#if ['Pending_Approval', 'Approved'].includes(task.status)}
                                <Button variant="ghost" size="sm" icon="edit" title="Edit" onclick={() => start_edit(task)} />
                                <Button variant="danger" size="sm" icon="delete" title="Delete" onclick={() => on_delete(task.id)} />
                            {/if}
                            {#if task.agent_log}
                                <details class="log-details">
                                    <summary><span class="icon" style="font-size:14px">terminal</span> View Log</summary>
                                    <CodeBlock content={task.agent_log} max_height="300px" />
                                </details>
                            {/if}
                            <Button variant="secondary" size="sm" icon="tune" title="Artifacts" onclick={() => toggle_artifacts(task.id)}>Artifacts</Button>
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
    .detail-section {
        margin-bottom: 1.25rem;
    }

    .detail-section h4 {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    .tasks-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .tasks-header h4 {
        margin-bottom: 0;
    }

    .tasks-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
    }

    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8rem;
        color: var(--fg-muted);
        cursor: pointer;
    }

    .task-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .task-item {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
    }

    .task-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
    }

    .task-desc {
        font-size: 0.85rem;
        color: var(--fg);
    }

    .task-actions {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
    }

    .task-add-form,
    .task-edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: var(--bg);
        border: 1px solid var(--accent);
        border-radius: var(--radius);
        padding: 0.75rem;
        margin-bottom: 0.5rem;
    }

    :global(.task-input) {
        background: var(--bg-elevated) !important;
    }

    .task-add-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }

    .log-details {
        width: 100%;
    }

    .log-details summary {
        cursor: pointer;
        font-size: 0.8rem;
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
</style>

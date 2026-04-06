<script lang="ts">
    import { api } from '$lib/api/client';
    import { Button, Input } from '$lib/components/primitives';
    import { DagGraph } from '$lib/components/dag-graph';
    import type { DagNode, DagEdge } from '$lib/components/dag-graph';
    import { EmptyState, Checkbox } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, TaskRow } from '$lib/types';
    import TaskItem from './TaskItem.svelte';

    type V2Update = { agent_type?: string, execution_strategy?: string, definition_of_done?: string | null, skills?: string[], context_paths?: string[] };

    interface Props {
        feature: Feature
        on_approve: (task_id: string) => Promise<void>
        on_approve_all: (feature_id: string) => Promise<void>
        on_spawn: (task_id: string) => Promise<void>
        on_add: (description: string) => Promise<void>
        on_update: (task_id: string, description: string, title?: string | null, v2?: V2Update) => Promise<void>
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
    let editing_v2 = $state({ agent_type: 'implementer', execution_strategy: 'sequential', definition_of_done: '', skills_text: '', context_paths_text: '' });
    let saving_task = $state(false);
    let managing_task_id: string | null = $state(null);
    let view_mode = $state<'list' | 'dag'>('list');
    let dag_nodes = $state<DagNode[]>([]);
    let dag_edges = $state<DagEdge[]>([]);
    const auto_approve = $derived(feature.auto_approve ?? false);

    const pending_tasks = $derived(feature.tasks?.filter((t: TaskRow) => t.status === 'queued') ?? []);

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
        editing_task_model = task.model ?? null;
        const skills = Array.isArray(task.skills) ? (task.skills as string[]).join(', ') : '';
        const ctx = Array.isArray(task.context_paths) ? (task.context_paths as string[]).join(', ') : '';
        editing_v2 = { agent_type: task.agent_type ?? 'implementer', execution_strategy: task.execution_strategy ?? 'sequential', definition_of_done: task.definition_of_done ?? '', skills_text: skills, context_paths_text: ctx };
    }

    async function save_edit() {
        if (!editing_task_id || !editing_task_desc.trim()) return;
        saving_task = true;
        try {
            const csv = (s: string) => s ? s.split(',').map((v) => v.trim()).filter(Boolean) : [];
            const v2: V2Update = { agent_type: editing_v2.agent_type, execution_strategy: editing_v2.execution_strategy,
                definition_of_done: editing_v2.definition_of_done || null,
                skills: csv(editing_v2.skills_text), context_paths: csv(editing_v2.context_paths_text) };
            await on_update(editing_task_id, editing_task_desc.trim(), editing_task_title.trim() || null, v2);
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
        await on_toggle_auto_approve(!auto_approve);
    }

    async function handle_approve_and_run_all() {
        const count = pending_tasks.length;
        if (count === 0) return;
        await on_approve_all(feature.id);
        toast_store.success(`${count} task${count > 1 ? 's' : ''} approved. The pipeline will run them automatically.`);
    }

    async function handle_guarded_approve(task_id: string) {
        const task = feature.tasks?.find((t: TaskRow) => t.id === task_id);
        if (task && task.status !== 'queued') {
            toast_store.warning('Task status has changed — please refresh before approving.');
            return;
        }
        await on_approve(task_id);
    }

    async function load_dag() {
        try {
            const d = await api.get_dag(feature.id);
            dag_nodes = ((d as Record<string, unknown>).nodes as DagNode[]) ?? [];
            dag_edges = ((d as Record<string, unknown>).edges as DagEdge[]) ?? [];
        }
        catch {
            dag_nodes = [];
            dag_edges = [];
        }
    }
</script>

<section class="detail-section" aria-label="Tasks">
    <div class="tasks-header">
        <h4><span class="icon" style="font-size:16px">task</span> Tasks ({feature.tasks?.length ?? 0})</h4>
        <div class="tasks-actions">
            <Button variant="ghost" size="sm" title={view_mode === 'list' ? 'DAG view' : 'List view'} onclick={() => {
                view_mode = view_mode === 'list' ? 'dag' : 'list';
                if (view_mode === 'dag') load_dag();
            }}>
                <span class="icon" style="font-size:16px">{view_mode === 'list' ? 'account_tree' : 'list'}</span>
            </Button>
            <label class="toggle-label">
                <Checkbox checked={auto_approve} onchange={handle_auto_approve_change} /> Auto-Approve
            </label>
            {#if pending_tasks.length > 0}
                <Button variant="primary" size="sm" icon="done_all" onclick={handle_approve_and_run_all}>Approve &amp; Run All</Button>
            {/if}
            <Button variant="secondary" size="sm" icon="add" onclick={() => {
                adding_task = true;
                new_task_desc = '';
            }}>Add Task</Button>
        </div>
    </div>

    {#if auto_approve}
        <div class="auto-approve-banner" role="status">
            <span class="icon" style="font-size:14px">bolt</span>
            Tasks are auto-approved. New tasks will run automatically.
        </div>
    {/if}

    {#if adding_task}
        <div class="task-add-form">
            <Input
                class="task-input"
                type="text"
                placeholder="Task description…"
                bind:value={new_task_desc}
                aria-label="Task description"
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
    {:else if view_mode === 'dag'}
        <DagGraph nodes={dag_nodes} edges={dag_edges} />
    {:else}
        <div class="task-list">
            {#each feature.tasks as task (task.id)}
                <TaskItem
                    {task}
                    {auto_approve}
                    editing={editing_task_id === task.id}
                    bind:editing_title={editing_task_title}
                    bind:editing_desc={editing_task_desc}
                    bind:editing_model={editing_task_model}
                    bind:editing_v2={editing_v2}
                    saving={saving_task}
                    on_approve={handle_guarded_approve}
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
</section>

<style>
    .detail-section { margin-bottom: 1.25rem; }
    .detail-section h4 { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem; }
    .tasks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
    .tasks-header h4 { margin-bottom: 0; }
    .tasks-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .toggle-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--fg-muted); cursor: pointer; }
    .task-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .auto-approve-banner {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.5rem 0.75rem; margin-bottom: 0.75rem;
        background: rgba(var(--success-rgb), 0.08); border: 1px solid rgba(var(--success-rgb), 0.2);
        border-radius: var(--radius); font-size: 0.8rem; color: var(--success);
    }
    .task-add-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: var(--bg); border: 1px solid var(--accent);
        border-radius: var(--radius); padding: 0.75rem; margin-bottom: 0.5rem;
    }
    .task-add-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>

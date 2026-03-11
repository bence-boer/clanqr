<script lang="ts">
    import { api } from '$lib/api/client';
    import { ConfirmModal, ErrorBanner } from '$lib/components';
    import { Badge, Button, Input, Select, Textarea } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, AbbreviatedAgentProcess, TaskRow } from '$lib/types';
    import TaskList from './TaskList.svelte';
    import ResourceList from './ResourceList.svelte';
    import { create_feature_handlers } from './feature_handlers';

    interface Props {
        feature: Feature
        agent_info: { processes: AbbreviatedAgentProcess[], pipeline: { state: string, is_active_feature: boolean, current_task_id: string | null } } | null
        on_submit: (feature_id: string) => Promise<void>
        on_delete: (feature_id: string) => Promise<void>
        on_duplicate: () => Promise<void>
        on_update: () => Promise<void>
        on_back: () => void
    }

    let { feature, agent_info, on_submit, on_delete, on_duplicate, on_update, on_back }: Props = $props();

    const handlers = create_feature_handlers(() => feature, () => on_update());

    type ModelOpt = { value: string, label: string };
    let editing = $state(false);
    let edit_title = $state('');
    let edit_description = $state('');
    let edit_planning_model = $state('');
    let edit_execution_model = $state('');
    let edit_cli = $state('copilot');
    let edit_execution_cli = $state('copilot');
    let edit_planning_models = $state<ModelOpt[]>([]);
    let edit_execution_models = $state<ModelOpt[]>([]);
    let loading_planning = $state(false);
    let loading_execution = $state(false);
    let saving_edit = $state(false);
    let last_plan_cli = $state('');
    let last_exec_cli = $state('');
    let show_details = $state(false);
    let show_submit_confirm = $state(false);
    let show_delete_confirm = $state(false);

    const procs = $derived(agent_info?.processes ?? []);
    const is_agent_active = $derived(
        procs.some((p) => p.status === 'running') || (agent_info?.pipeline.is_active_feature && agent_info?.pipeline.state === 'running')
    );
    const agent_label = $derived(procs.some((p) => p.status === 'running' && p.type === 'manager') ? 'Manager Processing' : 'Ralph Working');
    const plan_label = $derived(`Planning Model ${loading_planning ? '(...)' : ''}`);
    const exec_label = $derived(`Execution Model ${loading_execution ? '(...)' : ''}`);
    const save_disabled = $derived(saving_edit || !edit_title.trim() || !edit_planning_model || !edit_execution_model);

    // Task progress
    const tasks = $derived<TaskRow[]>(feature.tasks ?? []);
    const total_tasks = $derived(tasks.length);
    const completed_tasks = $derived(tasks.filter((t) => t.status === 'Complete').length);
    const failed_tasks = $derived(tasks.filter((t) => t.status === 'Failed').length);
    const in_progress_tasks = $derived(tasks.filter((t) => t.status === 'In_Progress').length);
    const pending_approval_tasks = $derived(tasks.filter((t) => t.status === 'Pending_Approval').length);
    const other_tasks = $derived(total_tasks - completed_tasks - failed_tasks - in_progress_tasks - pending_approval_tasks);

    function pct(count: number): string {
        if (total_tasks === 0) return '0%';
        return `${(count / total_tasks) * 100}%`;
    }

    async function load_edit_models(cli_val: string, kind: 'planning' | 'execution') {
        const is_plan = kind === 'planning';
        if (cli_val === (is_plan ? last_plan_cli : last_exec_cli)) return;
        if (is_plan) loading_planning = true;
        else loading_execution = true;
        try {
            const result = await api.list_models(cli_val);
            if (is_plan) {
                edit_planning_models = result;
                last_plan_cli = cli_val;
                if (!result.find((m) => m.value === edit_planning_model) && result.length > 0) edit_planning_model = result[0].value;
            }
            else {
                edit_execution_models = result;
                last_exec_cli = cli_val;
                if (!result.find((m) => m.value === edit_execution_model) && result.length > 0) edit_execution_model = result[0].value;
            }
        }
        catch {
            toast_store.error(`Failed to load ${kind} models`);
        }
        finally {
            if (is_plan) loading_planning = false;
            else loading_execution = false;
        }
    }

    $effect(() => {
        if (!editing) return;
        load_edit_models(edit_cli, 'planning');
        load_edit_models(edit_execution_cli, 'execution');
    });

    function start_editing() {
        edit_title = feature.title;
        edit_description = feature.description ?? '';
        edit_cli = feature.cli ?? 'copilot';
        edit_execution_cli = feature.execution_cli ?? feature.cli ?? 'copilot';
        edit_planning_model = feature.planning_model ?? '';
        edit_execution_model = feature.execution_model ?? '';
        last_plan_cli = '';
        last_exec_cli = '';
        editing = true;
    }

    async function save_edit(e?: Event) {
        e?.preventDefault();
        if (!edit_title.trim()) return;
        saving_edit = true;
        try {
            await handlers.save_edit({
                title: edit_title.trim(), description: edit_description.trim() || null,
                cli: edit_cli, execution_cli: edit_execution_cli,
                planning_model: edit_planning_model || null, execution_model: edit_execution_model || null
            });
            editing = false;
        }
        finally {
            saving_edit = false;
        }
    }

    async function handle_submit() {
        show_submit_confirm = false;
        await on_submit(feature.id);
    }

    async function handle_delete() {
        show_delete_confirm = false;
        await on_delete(feature.id);
    }
</script>

<section aria-label="Feature detail">
<div class="detail-top-bar">
    <Button variant="ghost" size="sm" onclick={on_back}><span class="icon">arrow_back</span> Back to features</Button>
</div>

<!-- 1. Header bar: Title + Status + Agent indicator + Action buttons -->
<div class="detail-header">
    <div style="display:flex; flex-direction:column; gap:0.25rem">
        <div class="title-row">
            <h3>{feature.title}</h3>
            <Badge variant={feature.status === 'Done' ? 'success' : feature.status === 'In_Progress' ? 'warning' : 'muted'}>
                {feature.status.replace('_', ' ')}
            </Badge>
        </div>
        {#if is_agent_active}
            <div class="agent-running-indicator" role="status" aria-live="polite">
                <span class="icon spin" style="font-size:12px; color:var(--accent)">progress_activity</span>
                <span style="font-size:0.65rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em">{agent_label}</span>
            </div>
        {/if}
    </div>
    <div class="detail-actions">
        {#if feature.status === 'Draft' && !editing}
            <Button variant="secondary" size="sm" onclick={start_editing}><span class="icon" style="font-size:14px">edit</span> Edit</Button>
            <Button variant="primary" size="sm" onclick={() => (show_submit_confirm = true)}><span class="icon" style="font-size:14px">send</span> Submit</Button>
        {/if}
        <Button variant="secondary" size="sm" onclick={on_duplicate} title="Duplicate feature"><span class="icon" style="font-size:14px">content_copy</span> Duplicate</Button>
        <Button variant="danger" size="sm" onclick={() => (show_delete_confirm = true)} aria-label="Delete feature"><span class="icon" style="font-size:14px">delete</span></Button>
    </div>
</div>
{#if feature.last_error}
    <ErrorBanner message="{feature.last_error}{feature.manager_retry_count > 0 ? ` (retry ${feature.manager_retry_count}/3)` : ''}" />
{/if}

<!-- 2. Task progress bar -->
{#if total_tasks > 0}
    <div class="progress-section">
        <div class="progress-bar" role="progressbar" aria-valuenow={completed_tasks} aria-valuemin={0} aria-valuemax={total_tasks}>
            {#if completed_tasks > 0}<div class="progress-segment complete" style="width:{pct(completed_tasks)}" title="{completed_tasks} complete"></div>{/if}
            {#if failed_tasks > 0}<div class="progress-segment failed" style="width:{pct(failed_tasks)}" title="{failed_tasks} failed"></div>{/if}
            {#if in_progress_tasks > 0}<div class="progress-segment in-progress" style="width:{pct(in_progress_tasks)}" title="{in_progress_tasks} in progress"></div>{/if}
            {#if pending_approval_tasks > 0}<div class="progress-segment pending-approval" style="width:{pct(pending_approval_tasks)}" title="{pending_approval_tasks} pending approval"></div>{/if}
            {#if other_tasks > 0}<div class="progress-segment other" style="width:{pct(other_tasks)}" title="{other_tasks} other"></div>{/if}
        </div>
        <span class="progress-label">{completed_tasks}/{total_tasks} tasks complete</span>
    </div>
{/if}

<div class="detail-body">
    {#if editing}
        <form class="edit-feature-form" onsubmit={save_edit}>
            <Input id="edit-title" type="text" bind:value={edit_title} label="Title" required />
            <Textarea id="edit-desc" bind:value={edit_description} label="Description" rows={4} />
            <div class="selection-grid">
                <div class="field"><Select id="edit-cli" label="Planning CLI" bind:value={edit_cli} class="input select">
                    <option value="copilot">Copilot CLI</option><option value="gemini">Gemini CLI</option>
                </Select></div>
                <div class="field">
                <Select id="edit-planning-model" label={plan_label} bind:value={edit_planning_model} disabled={loading_planning}>
                    {#each edit_planning_models as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
                </Select></div>
                <div class="field"><Select id="edit-execution-cli" label="Execution CLI" bind:value={edit_execution_cli} class="input select">
                    <option value="copilot">Copilot CLI</option><option value="gemini">Gemini CLI</option>
                </Select></div>
                <div class="field">
                <Select id="edit-execution-model" label={exec_label} bind:value={edit_execution_model} disabled={loading_execution}>
                    {#each edit_execution_models as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
                </Select></div>
            </div>
            <div class="form-actions">
                <Button type="button" variant="secondary" size="sm" onclick={() => (editing = false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={save_disabled}>
                    {saving_edit ? 'Saving...' : 'Save'}
                </Button>
            </div>
        </form>
    {:else}
        <!-- 3. Tasks section (MOVED UP) -->
        <TaskList {feature}
            on_approve={handlers.approve} on_approve_all={handlers.approve_all} on_spawn={handlers.spawn}
            on_add={handlers.add_task} on_update={handlers.update_task} on_delete={handlers.delete_task}
            on_toggle_auto_approve={handlers.toggle_auto_approve}
        />

        <!-- 4. Collapsible Details section -->
        <button class="details-toggle" onclick={() => (show_details = !show_details)}>
            <span class="icon" style="font-size:16px">{show_details ? 'expand_less' : 'expand_more'}</span>
            Details
        </button>
        {#if show_details}
            <div class="collapsible-details">
                <div class="detail-section">
                    <h4><span class="icon" style="font-size:16px">description</span> Description</h4>
                    <div class="description-text">{feature.description ?? 'No description'}</div>
                </div>
                <div class="detail-section">
                    <h4><span class="icon" style="font-size:16px">smart_toy</span> Engine & Model</h4>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
                        <Badge variant="muted">Plan: {feature.cli || 'copilot'}</Badge>
                        <Badge variant="muted">Exec: {feature.execution_cli || feature.cli || 'copilot'}</Badge>
                        <Badge variant="info">Planning: {feature.planning_model || 'Not set'}</Badge>
                        <Badge variant="info">Execution: {feature.execution_model || 'Not set'}</Badge>
                    </div>
                </div>
                <ResourceList {feature} on_add_resource={handlers.add_resource} on_remove_resource={handlers.remove_resource} />
            </div>
        {/if}
    {/if}
</div>
</section>

<ConfirmModal
    title="Submit for AI Processing"
    message="This will send '{feature.title}' to the AI pipeline for task generation. This cannot be undone."
    confirm_label="Submit"
    variant="default"
    open={show_submit_confirm}
    onconfirm={handle_submit}
    oncancel={() => (show_submit_confirm = false)}
/>

<ConfirmModal
    title="Delete Feature"
    message="Permanently delete '{feature.title}' and all its tasks? This cannot be undone."
    confirm_label="Delete"
    variant="danger"
    open={show_delete_confirm}
    onconfirm={handle_delete}
    oncancel={() => (show_delete_confirm = false)}
/>

<style>
    .detail-top-bar { display: none; }
    .detail-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1rem; padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 0.5rem;
    }
    .title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .detail-header h3 { font-size: 1.25rem; color: var(--fg); }
    .agent-running-indicator {
        display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.5rem;
        background: rgba(212, 175, 55, 0.1); border-radius: 4px; border: 1px solid rgba(212, 175, 55, 0.2);
    }
    .detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* Progress bar */
    .progress-section { margin-bottom: 1rem; }
    .progress-bar {
        display: flex; height: 8px; border-radius: 4px; overflow: hidden;
        background: var(--border); margin-bottom: 0.35rem;
    }
    .progress-segment { height: 100%; transition: width 0.3s ease; }
    .progress-segment.complete { background: #22c55e; }
    .progress-segment.failed { background: #ef4444; }
    .progress-segment.in-progress { background: #3b82f6; }
    .progress-segment.pending-approval { background: #eab308; }
    .progress-segment.other { background: #6b7280; }
    .progress-label { font-size: 0.75rem; color: var(--fg-muted); }

    .detail-section { margin-bottom: 1.25rem; }
    .detail-section h4 { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem; }
    .description-text { font-size: 0.875rem; color: var(--fg); line-height: 1.6; white-space: pre-wrap; }
    .edit-feature-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
    .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

    .details-toggle {
        display: flex; align-items: center; gap: 0.3rem;
        background: transparent; border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.5rem 0.75rem; color: var(--fg-muted); font-size: 0.85rem;
        cursor: pointer; transition: all 0.15s; width: 100%;
        font-family: var(--font); margin-top: 0.75rem; margin-bottom: 0.75rem;
    }
    .details-toggle:hover { border-color: var(--accent); color: var(--fg); }
    .collapsible-details { animation: slide-down 200ms ease; }
    @keyframes slide-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
        .detail-top-bar { display: block; margin-bottom: 0.75rem; }
        .selection-grid { grid-template-columns: 1fr; }
    }
</style>

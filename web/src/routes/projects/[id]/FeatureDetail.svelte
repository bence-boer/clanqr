<script lang="ts">
    import { ConfirmModal, ErrorBanner } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, TaskRow } from '$lib/types';
    import TaskList from './TaskList.svelte';
    import ResourceList from './ResourceList.svelte';
    import FeatureEditForm from './FeatureEditForm.svelte';
    import TaskProgressBar from './TaskProgressBar.svelte';
    import { WaveProgress } from '$lib/components/wave-progress';
    import type { WaveInfo } from '$lib/components/wave-progress';
    import { SvelteMap } from 'svelte/reactivity';
    import { create_feature_handlers } from './feature-handlers';

    interface Props {
        feature: Feature
        on_submit: (feature_id: string) => Promise<void>
        on_delete: (feature_id: string) => Promise<void>
        on_duplicate: () => Promise<void>
        on_update: () => Promise<void>
        on_back: () => void
    }

    let { feature, on_submit, on_delete, on_duplicate, on_update, on_back }: Props = $props();

    const handlers = create_feature_handlers(() => feature, () => on_update());

    let editing = $state(false);
    let show_details = $state(false);
    let show_submit_confirm = $state(false);
    let show_delete_confirm = $state(false);

    const tasks = $derived<TaskRow[]>(feature.tasks ?? []);
    const is_agent_active = $derived(feature.status === 'in_progress' && tasks.some((t) => t.status === 'in_progress'));

    const show_waves = $derived(['submitted', 'in_progress'].includes(feature.status));
    const waves = $derived.by((): WaveInfo[] => {
        const m = new SvelteMap<number, [number, number, number, number]>();
        for (const t of tasks) {
            if (t.wave_number == null) continue;
            const w = m.get(t.wave_number) ?? [0, 0, 0, 0];
            w[0]++;
            if (t.status === 'complete') w[1]++;
            else if (t.status === 'in_progress') w[2]++;
            else if (t.status === 'failed') w[3]++;
            m.set(t.wave_number, w);
        }
        return [...m].sort(([a], [b]) => a - b).map(([n, [t, c, r, f]]) => ({ wave: n, task_count: t, status: (f > 0 ? 'failed' : r > 0 ? 'running' : c === t ? 'completed' : 'pending') as WaveInfo['status'] }));
    });

    async function handle_save_edit(data: Parameters<typeof handlers.save_edit>[0]) {
        await handlers.save_edit(data);
        editing = false;
    }

    async function handle_submit() {
        show_submit_confirm = false;
        if (feature.status !== 'draft') {
            toast_store.warning(`Cannot submit — feature status is now "${feature.status.replace(/_/g, ' ')}".`);
            return;
        }
        await on_submit(feature.id);
    }

    async function handle_delete() {
        show_delete_confirm = false;
        if (feature.status === 'in_progress') {
            toast_store.warning('Cannot delete — feature is currently in progress.');
            return;
        }
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
            <Badge variant={feature.status === 'done' ? 'success' : feature.status === 'in_progress' ? 'warning' : 'muted'}>
                {feature.status.replace('_', ' ')}
            </Badge>
        </div>
        {#if is_agent_active}
            <div class="agent-running-indicator" role="status" aria-live="polite">
                <span class="icon spin" style="font-size:12px; color:var(--accent)">progress_activity</span>
                <span style="font-size:0.65rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em">Agent Working</span>
            </div>
        {/if}
    </div>
    <div class="detail-actions">
        {#if feature.status === 'draft' && !editing}
            <Button variant="secondary" size="sm" onclick={() => (editing = true)} icon="edit">Edit</Button>
            <Button variant="primary" size="sm" onclick={() => (show_submit_confirm = true)} icon="send">Submit</Button>
        {/if}
        <Button variant="secondary" size="sm" onclick={on_duplicate} title="Duplicate feature" icon="content_copy">Duplicate</Button>
        <Button variant="danger" size="sm" onclick={() => (show_delete_confirm = true)} aria-label="Delete feature" icon="delete">Delete</Button>
    </div>
</div>
{#if feature.last_error}
    <ErrorBanner message="{feature.last_error}{feature.manager_retry_count > 0 ? ` (retry ${feature.manager_retry_count}/3)` : ''}" />
{/if}

<TaskProgressBar {tasks} />
{#if show_waves && waves.length > 0}
    <WaveProgress {waves} compact={true} />
{/if}

<div class="detail-body">
    {#if editing}
        <FeatureEditForm {feature} on_save={handle_save_edit} on_cancel={() => (editing = false)} />
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
    on_confirm={handle_submit}
    on_cancel={() => (show_submit_confirm = false)}
/>

<ConfirmModal
    title="Delete Feature"
    message="Permanently delete '{feature.title}' and all its tasks? This cannot be undone."
    confirm_label="Delete"
    variant="danger"
    open={show_delete_confirm}
    on_confirm={handle_delete}
    on_cancel={() => (show_delete_confirm = false)}
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

    .detail-section { margin-bottom: 1.25rem; }
    .detail-section h4 { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem; }
    .description-text { font-size: 0.875rem; color: var(--fg); line-height: 1.6; white-space: pre-wrap; }

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
    }
</style>

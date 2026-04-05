<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner, LoadingSpinner, Tabs } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentSession, PipelineStatus, Task } from '$lib/types';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import CurrentTask from './CurrentTask.svelte';
    import PipelineHistory from './PipelineHistory.svelte';
    import PipelineStats from './PipelineStats.svelte';
    import PipelineStatusBar from './PipelineStatusBar.svelte';
    import TaskQueue from './TaskQueue.svelte';
    import { format_duration, reorder_queue, remove_from_queue, retry_task } from './pipeline-helpers';

    let pipeline = $state<PipelineStatus | null>(null);
    let queue = $state.raw<Task[]>([]);
    let history = $state.raw<AgentSession[]>([]);
    let history_total = $state(0);
    let history_page = $state(1);
    let history_total_pages = $state(1);
    let filter_status = $state('');
    let active_tab = $state('queue');

    let loading = $state(true);
    let action_error = $state('');
    let action_busy = $state(false);

    const pipeline_sections = [
        { label: 'Queue', value: 'queue' },
        { label: 'History', value: 'history' }
    ];

    async function load_pipeline() {
        try {
            pipeline = await api.pipeline_status();
        }
        catch (err) {
            console.error('Failed to load pipeline status:', err);
            toast_store.error('Failed to load pipeline status');
        }
    }

    async function load_queue() {
        try {
            queue = await api.list_tasks(undefined, 'approved');
        }
        catch (err) {
            console.error('Failed to load queue:', err);
            toast_store.error('Failed to load queue');
            queue = [];
        }
    }

    async function load_all() {
        await Promise.all([load_pipeline(), load_queue()]);
        loading = false;
    }

    const stream = use_event_stream(
        {
            pipeline_status: () => {
                load_pipeline();
                load_queue();
            },
            tasks_update: () => {
                load_queue();
            }
        },
        load_all,
        15_000
    );

    onMount(() => {
        load_all();
    });

    // Reload history when filter or page changes
    $effect(() => {
        void filter_status;
        void history_page;
        let cancelled = false;
        async function do_fetch() {
            try {
                const result = await api.usage_history(history_page, 20, 'ralph', filter_status || undefined);
                if (cancelled) return;
                history = result.runs;
                history_total = result.total;
                history_total_pages = result.total_pages;
            }
            catch (err) {
                if (cancelled) return;
                console.error('Failed to load history:', err);
                toast_store.error('Failed to load history');
                history = [];
            }
        }
        do_fetch();
        return () => {
            cancelled = true;
        };
    });

    async function do_action(action: () => Promise<unknown>, fail_msg: string) {
        action_busy = true;
        action_error = '';
        try {
            await action();
            await load_pipeline();
        }
        catch (e) {
            action_error = e instanceof Error ? e.message : fail_msg;
        }
        finally {
            action_busy = false;
        }
    }

    const do_pause = () => do_action(() => api.pipeline_pause(), 'Failed to pause');
    const do_resume = () => do_action(() => api.pipeline_resume(), 'Failed to resume');

    async function do_stop() {
        if (!confirm('Stop the currently running task?')) return;
        await do_action(() => api.pipeline_stop_current(), 'Failed to stop');
    }

</script>

<div class="page" aria-busy={loading}>
    <div class="page-header">
        <div>
            <h2>Pipeline</h2>
            <p class="subtitle">Execution queue and task history</p>
        </div>
    </div>

    {#if stream.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading pipeline..." />
    {:else}
        <PipelineStatusBar {pipeline} {action_busy} {action_error} on_pause={do_pause} on_resume={do_resume} on_stop={do_stop} />

        <PipelineStats {pipeline} {history} />

        <CurrentTask
            {pipeline}
            {action_busy}
            on_stop={do_stop}
            {format_duration}
        />

        <div class="pipeline-tabs">
            <Tabs items={pipeline_sections} bind:value={active_tab} aria_label="Pipeline sections" />
        </div>

        {#if active_tab === 'queue'}
            <TaskQueue {queue} on_reorder={(ids) => reorder_queue(ids, load_queue)} on_remove={(id) => remove_from_queue(id, load_queue)} />
        {:else}
            <PipelineHistory
                {history}
                {history_total}
                {history_page}
                {history_total_pages}
                {filter_status}
                on_filter_change={(status) => {
                    filter_status = status;
                    history_page = 1;
                }}
                on_page_change={(page) => {
                    history_page = page;
                }}
                on_retry={(id) => retry_task(id, load_queue)}
            />
        {/if}
    {/if}
</div>

<style>
    .page { max-width: 900px; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); }
    .subtitle { color: var(--fg-muted); font-size: 0.875rem; margin-top: 0.2rem; }
    .pipeline-tabs { margin-bottom: 1rem; }
    @media (max-width: 768px) { .page { overflow-x: hidden; } }
</style>

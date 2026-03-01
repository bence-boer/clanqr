<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner, LoadingSpinner } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentRun, PipelineStatus, Task } from '$lib/types';
    import { use_polling } from '$lib/utils/polling.svelte';
    import CurrentTask from './CurrentTask.svelte';
    import PipelineHistory from './PipelineHistory.svelte';
    import PipelineStatusBar from './PipelineStatusBar.svelte';
    import TaskQueue from './TaskQueue.svelte';

    let pipeline = $state<PipelineStatus | null>(null);
    let queue = $state<Task[]>([]);
    let history = $state<AgentRun[]>([]);
    let history_total = $state(0);
    let history_page = $state(1);
    let history_total_pages = $state(1);
    let filter_status = $state('');

    let loading = $state(true);
    let log_text = $state('');
    let log_visible = $state(false);
    let log_loading = $state(false);
    let action_error = $state('');
    let action_busy = $state(false);

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
            queue = await api.list_tasks(undefined, 'Approved');
        }
        catch (err) {
            console.error('Failed to load queue:', err);
            toast_store.error('Failed to load queue');
            queue = [];
        }
    }

    async function load_history() {
        try {
            const result = await api.usage_history(history_page, 20, 'ralph', filter_status || undefined);
            history = result.runs;
            history_total = result.total;
            history_total_pages = result.total_pages;
        }
        catch (err) {
            console.error('Failed to load history:', err);
            toast_store.error('Failed to load history');
            history = [];
        }
    }

    async function refresh_log() {
        log_loading = true;
        try {
            const result = await api.pipeline_log();
            log_text = result.log;
        }
        catch (err) {
            console.error('Failed to load log:', err);
            toast_store.error('Failed to load log');
            log_text = 'Failed to load log.';
        }
        finally {
            log_loading = false;
        }
    }

    // Poll every 3s
    const polling = use_polling(async () => {
        await Promise.all([load_pipeline(), load_queue()]);
        if (log_visible) refresh_log();
        loading = false;
        polling.mark_success();
    }, 3000);

    // Reload history when filter or page changes
    $effect(() => {
        void filter_status;
        void history_page;
        load_history();
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

    async function toggle_log() {
        log_visible = !log_visible;
        if (log_visible) await refresh_log();
    }

    function format_duration(started_at: string | null): string {
        if (!started_at) return '';
        const elapsed = Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
        if (elapsed < 60) return `${elapsed}s`;
        const m = Math.floor(elapsed / 60);
        return `${m}m ${elapsed % 60}s`;
    }
</script>

<div class="page" aria-busy={loading}>
    <div class="page-header">
        <div>
            <h2>Pipeline</h2>
            <p class="subtitle">Execution queue and task history</p>
        </div>
    </div>

    {#if polling.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading pipeline..." />
    {:else}
        <PipelineStatusBar {pipeline} {action_busy} {action_error} onpause={do_pause} onresume={do_resume} onstop={do_stop} />

        <CurrentTask
            {pipeline}
            {log_visible}
            {log_text}
            {log_loading}
            {action_busy}
            ontoggle_log={toggle_log}
            onstop={do_stop}
            onrefresh_log={refresh_log}
            {format_duration}
        />

        <TaskQueue {queue} />

        <PipelineHistory
            {history}
            {history_total}
            {history_page}
            {history_total_pages}
            {filter_status}
            onfilter_change={(status) => {
                filter_status = status;
                history_page = 1;
            }}
            onpage_change={(page) => {
                history_page = page;
            }}
        />
    {/if}
</div>

<style>
    .page { max-width: 900px; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); }
    .subtitle { color: var(--fg-muted); font-size: 0.875rem; margin-top: 0.2rem; }
    @media (max-width: 768px) { .page { overflow-x: hidden; } }
</style>

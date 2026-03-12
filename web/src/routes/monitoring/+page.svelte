<script lang="ts">
    import { api } from '$lib/api/client';
    import type { AgentProcess, PipelineStatus } from '$lib/types';
    import { EmptyState, ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import AgentGrid from './AgentGrid.svelte';
    import LogPanel from './LogPanel.svelte';
    import MonitoringFilters from './MonitoringFilters.svelte';
    import { get_empty_state } from './monitoring.utils';

    let agent_status = $state<Record<string, AgentProcess>>({});
    let pipeline = $state<PipelineStatus | null>(null);
    let selected_log = $state<string | null>(null);
    let log_content = $state('');
    let loading = $state(true);
    let stopping = $state(false);
    let filtered_entries = $state<[string, AgentProcess][]>([]);

    async function load_status() {
        try {
            const [status, pipeline_data] = await Promise.all([
                api.agent_status(),
                api.pipeline_status()
            ]);
            agent_status = status;
            pipeline = pipeline_data;
        }
        catch (error) {
            console.error('Failed to load agent status:', error);
            toast_store.error('Failed to load agent status');
        }
        finally {
            loading = false;
        }
    }

    const stream = use_event_stream(
        {
            agents_update: () => {
                load_status();
            }
        },
        load_status,
        15_000
    );

    onMount(() => {
        load_status();
    });

    async function view_log(task_id: string) {
        selected_log = task_id;
        try {
            const result = await api.agent_log(task_id);
            log_content = result.log || 'No log output yet.';
        }
        catch {
            toast_store.error('Failed to load log');
            log_content = 'Failed to load log.';
        }
    }

    async function refresh_log() {
        if (!selected_log) return;
        try {
            const result = await api.agent_log(selected_log);
            log_content = result.log || 'No log output yet.';
        }
        catch {
            /* silent — live tail will retry */
        }
    }

    async function stop_all() {
        stopping = true;
        try {
            await api.stop_all_agents();
            await load_status();
        }
        catch {
            toast_store.error('Failed to stop agents');
        }
        finally {
            stopping = false;
        }
    }

    async function stop_agent(task_id: string) {
        try {
            await api.stop_agent(task_id);
            await load_status();
        }
        catch {
            toast_store.error('Failed to stop agent');
        }
    }

    function close_log() {
        selected_log = null;
        log_content = '';
    }

    let entries = $derived(Object.entries(agent_status));
    let running_count = $derived(entries.filter(([, a]) => a.status === 'running').length);
    let completed_count = $derived(entries.filter(([, a]) => a.status === 'completed').length);
    let failed_count = $derived(entries.filter(([, a]) => a.status === 'failed').length);
    let selected_agent_status = $derived(
        selected_log ? agent_status[selected_log]?.status ?? null : null
    );
    let empty_state = $derived(entries.length === 0 ? get_empty_state(pipeline) : null);
</script>

<div class="page" aria-busy={loading}>
    <div class="page-header">
        <h2>Agent Monitoring</h2>
        {#if running_count > 0}
            <Button variant="danger" onclick={stop_all} disabled={stopping}>
                <span class="icon">stop_circle</span>
                {stopping ? 'Stopping...' : 'Stop All'}
            </Button>
        {/if}
    </div>

    {#if stream.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    <div class="stats">
        <StatCard icon="play_circle" value={running_count} label="Running" />
        <StatCard icon="check_circle" value={completed_count} label="Completed" />
        <StatCard icon="error" value={failed_count} label="Failed" />
    </div>

    {#if !loading && entries.length > 0}
        <MonitoringFilters {entries} bind:filtered_entries />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading agent status..." />
    {:else if entries.length === 0}
        {#if empty_state}
            <EmptyState
                icon={empty_state.icon}
                message={empty_state.message}
                detail={empty_state.detail}
                action_label={empty_state.action_label}
                action_href={empty_state.action_href}
            />
        {/if}
    {:else if filtered_entries.length === 0}
        <EmptyState
            icon="filter_alt"
            message="No matching agents."
            detail="Try adjusting your filters or search query."
        />
    {:else}
        <AgentGrid entries={filtered_entries} on_view_log={view_log} on_stop_agent={stop_agent} />
    {/if}

    {#if selected_log}
        <LogPanel
            {selected_log}
            {log_content}
            agent_status={selected_agent_status}
            on_close={close_log}
            on_refresh={refresh_log}
        />
    {/if}
</div>

<style>
    .page {
        max-width: 1000px;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }
    .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
    }
    @media (max-width: 768px) {
        .stats { grid-template-columns: 1fr; }
    }
</style>

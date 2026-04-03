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

    let agents = $state<AgentProcess[]>([]);
    let pipeline = $state<PipelineStatus | null>(null);
    let selected_log = $state<string | null>(null);
    let log_content = $state('');
    let loading = $state(true);
    let stopping = $state(false);
    let filtered_agents = $state<AgentProcess[]>([]);

    async function load_status() {
        try {
            const [status, pipeline_data] = await Promise.all([
                api.agent_status(),
                api.pipeline_status()
            ]);
            agents = Array.isArray(status) ? status : [];
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

    async function view_log(agent_id: string) {
        selected_log = agent_id;
        log_content = 'Loading...';

        const agent = agents.find((a) => a.id === agent_id);
        const sdk_sid = agent?.sdk_session_id;
        if (!sdk_sid) {
            log_content = 'No SDK session ID available for this agent.';
            return;
        }

        try {
            const result = await api.agent_logs(sdk_sid);
            if (result.entries.length > 0) {
                log_content = result.entries
                    .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${e.summary}`)
                    .join('\n');
            }
            else if (result.text) {
                log_content = result.text;
            }
            else {
                log_content = 'No log entries recorded for this session.';
            }
        }
        catch {
            log_content = 'Failed to fetch logs.';
        }
    }

    async function refresh_log() {
        if (!selected_log) return;
        await view_log(selected_log);
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

    function close_log() {
        selected_log = null;
        log_content = '';
    }

    let running_count = $derived(agents.filter((a) => a.status === 'running').length);
    let completed_count = $derived(agents.filter((a) => a.status === 'completed').length);
    let failed_count = $derived(agents.filter((a) => a.status === 'failed').length);
    let selected_agent_status = $derived(
        selected_log ? agents.find((a) => a.id === selected_log)?.status ?? null : null
    );
    let empty_state = $derived(agents.length === 0 ? get_empty_state(pipeline) : null);
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

    {#if !loading && agents.length > 0}
        <MonitoringFilters {agents} bind:filtered_agents />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading agent status..." />
    {:else if agents.length === 0}
        {#if empty_state}
            <EmptyState
                icon={empty_state.icon}
                message={empty_state.message}
                detail={empty_state.detail}
                action_label={empty_state.action_label}
                action_href={empty_state.action_href}
            />
        {/if}
    {:else if filtered_agents.length === 0}
        <EmptyState
            icon="filter_alt"
            message="No matching agents."
            detail="Try adjusting your filters or search query."
        />
    {:else}
        <AgentGrid agents={filtered_agents} on_view_log={view_log} />
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

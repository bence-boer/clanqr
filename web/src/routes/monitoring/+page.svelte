<script lang="ts">
    import { api } from '$lib/api/client';
    import type { AgentProcess, PipelineStatus } from '$lib/types';
    import { EmptyState, ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import AgentGrid from './AgentGrid.svelte';
    import SessionDetailPanel from './SessionDetailPanel.svelte';
    import MonitoringFilters from './MonitoringFilters.svelte';
    import { get_empty_state } from './monitoring.utils';

    let agents = $state.raw<AgentProcess[]>([]);
    let pipeline = $state<PipelineStatus | null>(null);
    let selected_agent = $state<AgentProcess | null>(null);
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
            if (selected_agent) {
                const current_id = selected_agent.id;
                const updated = agents.find((a) => a.id === current_id);
                if (updated) selected_agent = updated;
            }
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

    function select_agent(agent_id: string) {
        selected_agent = agents.find((a) => a.id === agent_id) ?? null;
    }

    async function stop_all() {
        stopping = true;
        try {
            await api.stop_all_agents();
            toast_store.success('All agents stopped');
            await load_status();
        }
        catch (error) {
            console.error(error);
            toast_store.error('Failed to stop agents');
        }
        finally {
            stopping = false;
        }
    }

    let running_count = $derived(agents.filter((a) => a.status === 'running').length);
    let completed_count = $derived(agents.filter((a) => a.status === 'completed').length);
    let failed_count = $derived(agents.filter((a) => a.status === 'failed').length);
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
        <MonitoringFilters {agents} onchange={(result) => filtered_agents = result} />
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
        <AgentGrid agents={filtered_agents} on_view_log={select_agent} />
    {/if}

    {#if selected_agent}
        <SessionDetailPanel agent={selected_agent} on_close={() => selected_agent = null} />
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

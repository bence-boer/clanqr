<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import AgentGrid from './AgentGrid.svelte';
    import LogPanel from './LogPanel.svelte';

    let agent_status = $state<Record<string, { status: string, type: string, started_at: string | null, finished_at?: string | null }>>({});
    let selected_log = $state<string | null>(null);
    let log_content = $state('');
    let loading = $state(true);
    let stopping = $state(false);

    async function load_status() {
        try {
            agent_status = await api.agent_status();
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

    {#if loading}
        <LoadingSpinner label="Loading agent status..." />
    {:else if entries.length === 0}
        <EmptyState
            icon="smart_toy"
            message="No agent processes yet."
            detail="Submit a feature to trigger the Manager agent, or approve tasks to trigger Ralph agents."
        />
    {:else}
        <AgentGrid {entries} on_view_log={view_log} on_stop_agent={stop_agent} />
    {/if}

    {#if selected_log}
        <LogPanel {selected_log} {log_content} on_close={close_log} />
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

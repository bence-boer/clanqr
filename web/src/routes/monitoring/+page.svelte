<script lang="ts">
    import { api } from '$lib/api/client';
    import type { AgentProcess, PipelineStatus } from '$lib/types';
    import { EmptyState, ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { Button, Input, Select } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
    import AgentGrid from './AgentGrid.svelte';
    import LogPanel from './LogPanel.svelte';

    type StatusFilter = 'all' | 'running' | 'completed' | 'failed';
    type SortOption = 'newest' | 'oldest' | 'longest';

    let agent_status = $state<Record<string, AgentProcess>>({});
    let pipeline = $state<PipelineStatus | null>(null);
    let selected_log = $state<string | null>(null);
    let log_content = $state('');
    let loading = $state(true);
    let stopping = $state(false);

    let filter_status = $state<StatusFilter>('all');
    let sort_by = $state<SortOption>('newest');
    let search_query = $state('');

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

    let filtered_entries = $derived.by(() => {
        let result = entries;

        if (filter_status !== 'all') {
            result = result.filter(([, a]) => a.status === filter_status);
        }

        if (search_query.trim()) {
            const query = search_query.trim().toLowerCase();
            result = result.filter(([id, a]) =>
                id.toLowerCase().includes(query)
                || a.type.toLowerCase().includes(query)
                || a.task_id.toLowerCase().includes(query)
            );
        }

        result = [...result].sort((a_entry, b_entry) => {
            const a_agent = a_entry[1];
            const b_agent = b_entry[1];
            if (sort_by === 'newest') {
                return new Date(b_agent.started_at ?? 0).getTime() - new Date(a_agent.started_at ?? 0).getTime();
            }
            if (sort_by === 'oldest') {
                return new Date(a_agent.started_at ?? 0).getTime() - new Date(b_agent.started_at ?? 0).getTime();
            }
            // longest running — running agents sorted by oldest start (longest first)
            const a_running = a_agent.status === 'running' ? 1 : 0;
            const b_running = b_agent.status === 'running' ? 1 : 0;
            if (a_running !== b_running) return b_running - a_running;
            return new Date(a_agent.started_at ?? 0).getTime() - new Date(b_agent.started_at ?? 0).getTime();
        });

        return result;
    });

    let selected_agent_status = $derived(
        selected_log ? agent_status[selected_log]?.status ?? null : null
    );

    const filter_options: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'running', label: 'Running' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' }
    ];

    let empty_state = $derived.by(() => {
        if (entries.length > 0) return null;
        if (!pipeline) {
            return {
                icon: 'smart_toy' as const,
                message: 'Pipeline is idle.',
                detail: 'Submit a feature to start agent processing.',
                action_label: 'Go to Projects',
                action_href: '/projects'
            };
        }
        if (pipeline.state === 'running') {
            return {
                icon: 'hourglass_top' as const,
                message: 'Pipeline is running.',
                detail: 'Agents will appear here when tasks are picked up.',
                action_label: 'View Pipeline',
                action_href: '/pipeline'
            };
        }
        if (pipeline.state === 'paused') {
            return {
                icon: 'pause_circle' as const,
                message: 'Pipeline is paused.',
                detail: 'Resume the pipeline to start processing tasks.',
                action_label: 'View Pipeline',
                action_href: '/pipeline'
            };
        }
        return {
            icon: 'smart_toy' as const,
            message: 'Pipeline is idle.',
            detail: 'Submit a feature to start agent processing.',
            action_label: 'Go to Projects',
            action_href: '/projects'
        };
    });
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
        <div class="toolbar">
            <div class="filter-pills" role="group" aria-label="Filter by status">
                {#each filter_options as option (option.value)}
                    <Button
                        variant="filter"
                        size="sm"
                        active={filter_status === option.value}
                        onclick={() => filter_status = option.value}
                    >
                        {option.label}
                    </Button>
                {/each}
            </div>

            <div class="toolbar-controls">
                <Input
                    placeholder="Search agents..."
                    bind:value={search_query}
                    style="max-width: 220px"
                />

                <Select bind:value={sort_by} style="max-width: 180px">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="longest">Longest running</option>
                </Select>
            </div>
        </div>
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
    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .filter-pills {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
    }
    .toolbar-controls {
        display: flex;
        gap: 0.5rem;
        align-items: flex-end;
        flex-wrap: wrap;
    }
    @media (max-width: 768px) {
        .stats { grid-template-columns: 1fr; }
        .toolbar { flex-direction: column; align-items: stretch; }
        .toolbar-controls { flex-direction: column; }
    }
</style>

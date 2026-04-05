<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner, LoadingSpinner } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { ActivityEvent, PipelineStatus, SystemAlert, SystemStats } from '$lib/types';
    import { use_event_stream, type PipelineStatusData, type SnapshotData } from '$lib/utils/event-stream.svelte';
    import { onDestroy, onMount } from 'svelte';
    import ActivityFeed from './ActivityFeed.svelte';
    import KpiBar from './KpiBar.svelte';
    import PipelineCard from './PipelineCard.svelte';
    import SystemStatsCard from './SystemStatsCard.svelte';

    let loading = $state(true);
    let pipeline = $state<PipelineStatus | null>(null);
    let system_stats = $state<SystemStats | null>(null);
    let system_alerts = $state<SystemAlert[]>([]);
    let stats_auto_refresh = $state(false);
    let stats_interval_id: ReturnType<typeof setInterval> | null = null;
    let activity_events = $state<ActivityEvent[]>([]);
    let health_expanded = $state(false);
    let active_agents = $state(0);
    let pending_approval_count = $state(0);

    async function load_data() {
        try {
            const [task_list, pipeline_status, agent_map] = await Promise.all([
                api.list_tasks(),
                api.pipeline_status().catch(() => null),
                api.agent_status().catch(() => ({} as Record<string, unknown>))
            ]);
            pipeline = pipeline_status;
            pending_approval_count = task_list.filter((t) => t.status === 'queued').length;
            active_agents = Object.keys(agent_map).length;
        }
        catch (error) {
            console.error('Failed to load dashboard:', error);
            toast_store.error('Failed to load dashboard');
        }
        finally {
            loading = false;
        }
    }

    async function load_activity() {
        try {
            activity_events = await api.activity_feed(20);
        }
        catch {
            // Silently fail — activity feed is supplementary
        }
    }

    async function load_system_stats() {
        try {
            const [stats, alerts_resp] = await Promise.all([api.system_stats(), api.system_alerts().catch(() => ({ alerts: [] }))]);
            system_stats = stats;
            system_alerts = alerts_resp.alerts;
        }
        catch (error) {
            console.error(error);
            toast_store.error('Failed to load system stats');
        }
    }

    const stream = use_event_stream(
        {
            snapshot: (data: SnapshotData) => {
                pipeline = {
                    ...pipeline,
                    state: data.pipeline.state,
                    current_task: null,
                    current_run_id: data.pipeline.current_run_id,
                    queue_depth: pipeline?.queue_depth ?? 0
                } as PipelineStatus;
                active_agents = Object.keys(data.agents).length;
            },
            pipeline_status: (data: PipelineStatusData) => {
                if (pipeline) {
                    pipeline = { ...pipeline, state: data.state as PipelineStatus['state'], current_run_id: data.current_run_id ?? null };
                }
                load_data();
                load_activity();
            },
            features_update: () => {
                load_data();
                load_activity();
            }
        },
        load_data,
        15_000
    );

    onMount(() => {
        load_data();
        load_system_stats();
        load_activity();
    });

    onDestroy(() => {
        if (stats_interval_id) {
            clearInterval(stats_interval_id);
            stats_interval_id = null;
        }
    });

    function toggle_stats_refresh() {
        stats_auto_refresh = !stats_auto_refresh;
        if (stats_interval_id) {
            clearInterval(stats_interval_id);
            stats_interval_id = null;
        }
        if (stats_auto_refresh) {
            stats_interval_id = setInterval(load_system_stats, 15000);
        }
    }

</script>

<div class="dashboard" aria-busy={loading}>
    <h2>Dashboard</h2>

    {#if stream.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading..." />
    {:else}
        <KpiBar {pipeline} {active_agents} {pending_approval_count} {system_stats} on_health_click={() => health_expanded = !health_expanded} />

        {#if health_expanded}
            <SystemStatsCard {system_stats} {system_alerts} {stats_auto_refresh} on_refresh={load_system_stats} on_toggle_auto_refresh={toggle_stats_refresh} />
        {/if}

        <PipelineCard {pipeline} on_pause={() => api.pipeline_pause().then(load_data).catch((e: unknown) => {
            console.error(e);
            toast_store.error('Failed to pause pipeline');
        })} on_resume={() => api.pipeline_resume().then(load_data).catch((e: unknown) => {
            console.error(e);
            toast_store.error('Failed to resume pipeline');
        })} />

        <ActivityFeed events={activity_events} />
    {/if}
</div>

<style>
    .dashboard h2 {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
        color: var(--fg);
    }
</style>

<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { PipelineStatus, Project, SystemAlert, SystemStats } from '$lib/types';
    import { use_polling } from '$lib/utils/polling.svelte';
    import { onDestroy, onMount } from 'svelte';
    import PipelineCard from './PipelineCard.svelte';
    import PipelineStat from './PipelineStat.svelte';
    import QuickActions from './QuickActions.svelte';
    import SystemStatsCard from './SystemStatsCard.svelte';

    let projects = $state<Project[]>([]);
    let loading = $state(true);
    let pipeline = $state<PipelineStatus | null>(null);
    let system_stats = $state<SystemStats | null>(null);
    let system_alerts = $state<SystemAlert[]>([]);
    let stats_auto_refresh = $state(false);
    let stats_interval_id: ReturnType<typeof setInterval> | null = null;

    async function load_data() {
        try {
            const [project_list, pipeline_status] = await Promise.all([api.list_projects(), api.pipeline_status().catch(() => null)]);
            projects = project_list;
            pipeline = pipeline_status;
            polling.mark_success();
        }
        catch (error) {
            console.error('Failed to load dashboard:', error);
            toast_store.error('Failed to load dashboard');
        }
        finally {
            loading = false;
        }
    }

    async function load_system_stats() {
        try {
            const [stats, alerts_resp] = await Promise.all([api.system_stats(), api.system_alerts().catch(() => ({ alerts: [] }))]);
            system_stats = stats;
            system_alerts = alerts_resp.alerts;
        }
        catch {
            toast_store.error('Failed to load system stats');
        }
    }

    const polling = use_polling(load_data, 5000);

    onMount(() => {
        load_system_stats();
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

    let total_features = $derived(projects.reduce((sum, project) => sum + (project.features?.length ?? 0), 0));
</script>

<div class="dashboard" aria-busy={loading}>
    <h2>Dashboard</h2>

    {#if polling.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading..." />
    {:else}
        <div class="stats">
            <StatCard icon="folder" value={projects.length} label="Projects" href="/projects" />
            <StatCard icon="category" value={total_features} label="Features" href="/projects" />
            <PipelineStat {pipeline} />
        </div>

        <SystemStatsCard {system_stats} {system_alerts} {stats_auto_refresh} onrefresh={load_system_stats} ontoggle_auto_refresh={toggle_stats_refresh} />

        <PipelineCard {pipeline} onpause={() => api.pipeline_pause().then(load_data)} onresume={() => api.pipeline_resume().then(load_data)} />

        <QuickActions />
    {/if}
</div>

<style>
    .dashboard h2 {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
        color: var(--fg);
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
    }
</style>

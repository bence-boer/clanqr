<script lang="ts">
    import { admin_api } from '$lib/api/admin-client';
    import { EmptyState, LoadingSpinner, StatCard } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { onMount } from 'svelte';

    interface MetricEntry {
        total_requests: number
        total_errors: number
        avg_latency_ms: number
        p95_latency_ms: number
    }

    let metrics: Record<string, MetricEntry> = $state({});
    let metrics_loading = $state(false);

    let sorted_metrics = $derived(
        Object.entries(metrics)
            .map(([route, data]) => ({ route, ...data }))
            .sort((a, b) => b.p95_latency_ms - a.p95_latency_ms)
    );

    let error_routes = $derived(
        sorted_metrics.filter((m) => m.total_errors > 0).sort((a, b) => b.total_errors - a.total_errors)
    );

    let top_volume = $derived(
        [...sorted_metrics].sort((a, b) => b.total_requests - a.total_requests).slice(0, 10)
    );

    async function load_metrics() {
        metrics_loading = true;
        try {
            metrics = await admin_api.load_metrics();
        }
        catch (error) {
            console.error(error);
            toast_store.error('Failed to load metrics');
        }
        finally {
            metrics_loading = false;
        }
    }

    onMount(() => {
        load_metrics();
    });
</script>

{#if metrics_loading}
    <LoadingSpinner label="Loading metrics…" />
{:else if sorted_metrics.length === 0}
    <EmptyState icon="analytics" message="No metrics data yet" detail="Metrics will appear once the API starts receiving traffic." />
{:else}
    <div class="metrics-grid">
        <StatCard label="Total Endpoints" value={String(sorted_metrics.length)} icon="api" />
        <StatCard label="Total Requests" value={String(sorted_metrics.reduce((s, m) => s + m.total_requests, 0))} icon="trending_up" />
        <StatCard label="Total Errors" value={String(sorted_metrics.reduce((s, m) => s + m.total_errors, 0))} icon="error" />
    </div>

    <h4 class="section-heading">Slowest Endpoints (P95)</h4>
    <div class="metrics-table-wrap">
        <table class="metrics-table">
            <thead><tr><th>Route</th><th>P95 (ms)</th><th>Avg (ms)</th><th>Reqs</th><th>Errors</th></tr></thead>
            <tbody>
                {#each sorted_metrics.slice(0, 15) as m (m.route)}
                    <tr>
                        <td class="route-cell">{m.route}</td>
                        <td class="num">{m.p95_latency_ms}</td>
                        <td class="num">{m.avg_latency_ms}</td>
                        <td class="num">{m.total_requests}</td>
                        <td class="num" class:error-cell={m.total_errors > 0}>{m.total_errors}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    {#if error_routes.length > 0}
        <h4 class="section-heading">Error Routes</h4>
        <div class="metrics-table-wrap">
            <table class="metrics-table">
                <thead><tr><th>Route</th><th>Errors</th><th>Error Rate</th></tr></thead>
                <tbody>
                    {#each error_routes as m (m.route)}
                        <tr>
                            <td class="route-cell">{m.route}</td>
                            <td class="num error-cell">{m.total_errors}</td>
                            <td class="num error-cell">{m.total_requests > 0 ? ((m.total_errors / m.total_requests) * 100).toFixed(1) : 0}%</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    <h4 class="section-heading">Highest Volume</h4>
    <div class="metrics-table-wrap">
        <table class="metrics-table">
            <thead><tr><th>Route</th><th>Requests</th><th>Avg (ms)</th></tr></thead>
            <tbody>
                {#each top_volume as m (m.route)}
                    <tr>
                        <td class="route-cell">{m.route}</td>
                        <td class="num">{m.total_requests}</td>
                        <td class="num">{m.avg_latency_ms}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <div style="margin-top: 1rem;">
        <Button variant="secondary" size="sm" icon="refresh" onclick={load_metrics}>Refresh Metrics</Button>
    </div>
{/if}

<style>
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }
    .section-heading {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin: 1.25rem 0 0.5rem;
    }
    .metrics-table-wrap {
        overflow-x: auto;
    }
    .metrics-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
    }
    .metrics-table th {
        text-align: left;
        padding: 0.45rem 0.6rem;
        color: var(--fg-muted);
        border-bottom: 1px solid var(--border);
        font-weight: 600;
        white-space: nowrap;
    }
    .metrics-table td {
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid var(--border);
        color: var(--fg);
    }
    .route-cell {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .error-cell { color: var(--danger, #c9544a); font-weight: 600; }
    .empty-text { color: var(--fg-muted); font-size: 0.85rem; }
</style>

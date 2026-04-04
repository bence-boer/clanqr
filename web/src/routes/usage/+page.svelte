<script lang="ts">
    import { api } from '$lib/api/client';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentSession, UsageBreakdown, UsageSummary } from '$lib/types';
    import { onMount } from 'svelte';
    import { SvelteDate } from 'svelte/reactivity';
    import RunHistory from './RunHistory.svelte';
    import UsageBreakdownPanel from './UsageBreakdown.svelte';
    import UsageSummaryPanel from './UsageSummary.svelte';

    let summary = $state<UsageSummary | null>(null);
    let breakdown = $state<UsageBreakdown | null>(null);
    let runs = $state.raw<AgentSession[]>([]);
    let total_pages = $state(1);
    let total_count = $state(0);
    let loading_summary = $state(true);
    let loading_breakdown = $state(true);
    let loading_history = $state(true);
    let filter_type = $state('');
    let filter_status = $state('');
    let current_page = $state(1);
    let date_range = $state<'today' | '7d' | '30d' | 'all'>('all');

    onMount(() => {
        api.usage_summary()
            .then((data) => {
                summary = data;
            })
            .catch((err) => {
                console.error('usage summary error:', err);
                toast_store.error('Failed to load usage summary');
            })
            .finally(() => {
                loading_summary = false;
            });

        api.usage_breakdown()
            .then((data) => {
                breakdown = data;
            })
            .catch((err) => {
                console.error('usage breakdown error:', err);
                toast_store.error('Failed to load usage breakdown');
            })
            .finally(() => {
                loading_breakdown = false;
            });
    });

    $effect(() => {
        const page = current_page;
        const type = filter_type;
        const status = filter_status;
        let cancelled = false;

        loading_history = true;
        api.usage_history(page, 20, type || undefined, status || undefined)
            .then((result) => {
                if (cancelled) return;
                runs = result.runs;
                total_pages = result.total_pages;
                total_count = result.total;
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('usage history error:', err);
                toast_store.error('Failed to load usage history');
            })
            .finally(() => {
                if (!cancelled) loading_history = false;
            });

        return () => {
            cancelled = true;
        };
    });

    function get_date_cutoff(range: typeof date_range): SvelteDate | null {
        const now_ms = Date.now();
        if (range === 'today') {
            const start = new SvelteDate(now_ms);
            start.setHours(0, 0, 0, 0);
            return start;
        }
        if (range === '7d') return new SvelteDate(now_ms - 7 * 24 * 60 * 60 * 1000);
        if (range === '30d') return new SvelteDate(now_ms - 30 * 24 * 60 * 60 * 1000);
        return null;
    }

    let filtered_runs = $derived.by(() => {
        const cutoff = get_date_cutoff(date_range);
        if (!cutoff) return runs;
        return runs.filter((run) => new Date(run.created_at) >= cutoff);
    });
</script>

<div class="page">
    <div class="page-header">
        <h2>Usage Analytics</h2>
    </div>

    <UsageSummaryPanel {summary} loading={loading_summary} />

    <UsageBreakdownPanel {breakdown} loading={loading_breakdown} />

    <RunHistory
        runs={filtered_runs}
        {total_pages}
        {total_count}
        loading={loading_history}
        {filter_type}
        {filter_status}
        {current_page}
        {date_range}
        on_filter_type_change={(value) => {
            filter_type = value;
            current_page = 1;
        }}
        on_filter_status_change={(value) => {
            filter_status = value;
            current_page = 1;
        }}
        on_page_change={(page) => {
            current_page = page;
        }}
        on_date_range_change={(value) => {
            date_range = value;
        }}
    />
</div>

<style>
    .page {
        max-width: 960px;
        overflow-x: hidden;
    }

    .page-header {
        display: flex;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }
</style>

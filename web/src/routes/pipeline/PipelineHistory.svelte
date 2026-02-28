<script lang="ts">
    import { CodeBlock, EmptyState } from '$lib/components';
    import { Badge, Button, Select } from '$lib/components/primitives';
    import type { AgentRun } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';

    let {
        history,
        history_total,
        history_page,
        history_total_pages,
        filter_status,
        onfilter_change,
        onpage_change
    }: {
        history: AgentRun[];
        history_total: number;
        history_page: number;
        history_total_pages: number;
        filter_status: string;
        onfilter_change: (status: string) => void;
        onpage_change: (page: number) => void;
    } = $props();

    let expanded_run = $state<string | null>(null);

    function toggle_run_log(id: string) {
        expanded_run = expanded_run === id ? null : id;
    }

    function get_run_ref_label(run: AgentRun): string {
        const ref_id = run.feature_id ?? run.task_id ?? run.session_id;
        if (!ref_id) return run.type;
        const kind = run.type === 'manager' ? 'Feature' : run.type === 'ralph' ? 'Task' : 'Chat';
        return `${kind} · ${ref_id.slice(0, 12)}`;
    }

    function format_ms(ms: number | null): string {
        if (ms === null) return '—';
        if (ms < 1000) return '< 1s';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    }

    function format_date(iso: string) {
        return new Date(iso).toLocaleString();
    }
</script>

<section class="section">
    <div class="section-header-row">
        <h3 class="section-title">
            <span class="icon">history</span>
            Run History
            {#if history_total > 0}
                <Badge variant="muted">{history_total}</Badge>
            {/if}
        </h3>
        <div class="history-filters">
            <Select
                class="filter-select"
                value={filter_status}
                onchange={(e) => {
                    onfilter_change(e.currentTarget.value);
                }}
            >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
            </Select>
        </div>
    </div>

    {#if history.length === 0}
        <EmptyState icon="receipt_long" message="No runs yet" />
    {:else}
        <div class="history-list">
            {#each history as run}
                <div class="history-item">
                    <div class="history-item-header">
                        <div class="history-item-left">
                            <span class="icon run-status-icon {status_class(run.status)}">{status_icon(run.status)}</span>
                            <div>
                                <p class="run-ref">{get_run_ref_label(run)}</p>
                                <p class="run-meta">{format_date(run.created_at)} · {format_ms(run.duration_ms)}</p>
                            </div>
                        </div>
                        <div class="history-item-right">
                            <Badge variant={status_class(run.status) as any}>{run.status}</Badge>
                            {#if run.log}
                                <Button variant="ghost" size="icon" icon="terminal" onclick={() => toggle_run_log(run.id)} title="View log" />
                            {/if}
                        </div>
                    </div>

                    {#if expanded_run === run.id && run.log}
                        <CodeBlock content={run.log} max_height="200px" />
                    {/if}
                    {#if run.error}
                        <p class="run-error">{run.error}</p>
                    {/if}
                </div>
            {/each}
        </div>

        {#if history_total_pages > 1}
            <div class="pagination">
                <Button variant="secondary" size="sm" icon="chevron_left" disabled={history_page <= 1} onclick={() => onpage_change(history_page - 1)} />
                <span class="page-info">Page {history_page} of {history_total_pages}</span>
                <Button
                    variant="secondary"
                    size="sm"
                    icon="chevron_right"
                    disabled={history_page >= history_total_pages}
                    onclick={() => onpage_change(history_page + 1)}
                />
            </div>
        {/if}
    {/if}
</section>

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .section-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .section-header-row .section-title {
        margin-bottom: 0;
    }

    .history-filters {
        display: flex;
        gap: 0.5rem;
    }

    .filter-select {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        font-size: 0.8rem;
        padding: 0.35rem 0.65rem;
        cursor: pointer;
        font-family: var(--font);
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .history-item {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem 1rem;
    }

    .history-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .history-item-left {
        display: flex;
        align-items: center;
        gap: 0.65rem;
    }

    .history-item-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .run-status-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    .run-status-icon.success {
        color: var(--success);
    }
    .run-status-icon.danger {
        color: var(--danger);
    }
    .run-status-icon.warning {
        color: var(--accent);
    }
    .run-status-icon.muted {
        color: var(--fg-muted);
    }

    .run-ref {
        font-size: 0.875rem;
        color: var(--fg);
        font-family: monospace;
    }
    .run-meta {
        font-size: 0.75rem;
        color: var(--fg-muted);
    }
    .run-error {
        font-size: 0.8rem;
        color: var(--danger);
        margin-top: 0.4rem;
    }

    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .page-info {
        font-size: 0.8rem;
        color: var(--fg-muted);
    }

    @media (max-width: 768px) {
        .pagination {
            flex-wrap: wrap;
            gap: 0.5rem;
        }
    }
</style>

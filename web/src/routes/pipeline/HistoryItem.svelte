<script lang="ts">
    import { CodeBlock } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import type { AgentRun } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';

    let {
        run,
        expanded,
        on_toggle_log
    }: {
        run: AgentRun
        expanded: boolean
        on_toggle_log: (id: string) => void
    } = $props();

    function get_run_ref_label(r: AgentRun): string {
        const ref_id = r.feature_id ?? r.task_id ?? r.session_id;
        if (!ref_id) return r.type;
        const kind = r.type === 'manager' ? 'Feature' : r.type === 'ralph' ? 'Task' : 'Chat';
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
            <Badge variant={status_class(run.status) as 'success' | 'danger' | 'muted' | 'info'}>{run.status}</Badge>
            {#if run.log}
                <Button variant="ghost" size="icon" icon="terminal" onclick={() => on_toggle_log(run.id)} title="View log" />
            {/if}
        </div>
    </div>

    {#if expanded && run.log}
        <CodeBlock content={run.log} max_height="200px" />
    {/if}
    {#if run.error}
        <p class="run-error">{run.error}</p>
    {/if}
</div>

<style>
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
    .run-status-icon.success { color: var(--success); }
    .run-status-icon.danger { color: var(--danger); }
    .run-status-icon.warning { color: var(--accent); }
    .run-status-icon.muted { color: var(--fg-muted); }
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
</style>

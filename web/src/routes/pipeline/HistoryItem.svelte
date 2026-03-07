<script lang="ts">
    import { resolve } from '$app/paths';
    import { CodeBlock } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import type { AgentRun } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';

    let {
        run,
        expanded,
        on_toggle_log
    }: {
        run: AgentRun & {
            tasks?: {
                id: string
                title: string | null
                feature_id: string
                features?: {
                    id: string
                    title: string
                    project_id: string
                    projects?: { id: string, name: string } | null
                } | null
            } | null
        }
        expanded: boolean
        on_toggle_log: (id: string) => void
    } = $props();

    function get_run_label(r: typeof run): string {
        if (r.tasks?.title) return r.tasks.title;
        if (r.tasks?.id) return `Task · ${r.tasks.id.slice(0, 12)}`;
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

    const project_id = $derived(run.tasks?.features?.project_id ?? run.tasks?.features?.projects?.id);
    const project_name = $derived(run.tasks?.features?.projects?.name);
    const feature_id = $derived(run.tasks?.feature_id ?? run.tasks?.features?.id);
    const feature_title = $derived(run.tasks?.features?.title);
</script>

<div class="history-item">
    <div class="history-item-header">
        <div class="history-item-left">
            <span class="icon run-status-icon {status_class(run.status)}">{status_icon(run.status)}</span>
            <div>
                {#if project_name || feature_title}
                    <div class="run-breadcrumb">
                        {#if project_id && project_name}
                            <a href={resolve(`/projects/${project_id}`)} class="crumb-link">{project_name}</a>
                        {/if}
                        {#if feature_id && feature_title && project_id}
                            <span class="crumb-sep">/</span>
                            <a href={resolve(`/projects/${project_id}?feature=${feature_id}`)} class="crumb-link">{feature_title}</a>
                        {/if}
                        <span class="crumb-sep">/</span>
                        <span class="crumb-current">{get_run_label(run)}</span>
                    </div>
                {:else}
                    <p class="run-ref">{get_run_label(run)}</p>
                {/if}
                <p class="run-meta">{format_date(run.created_at)} · {format_ms(run.duration_ms)}</p>
                {#if run.summary}
                    <p class="run-summary">{run.summary}</p>
                {/if}
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
        align-items: flex-start;
        gap: 0.65rem;
        min-width: 0;
        flex: 1;
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
        margin-top: 0.1rem;
    }
    .run-status-icon.success { color: var(--success); }
    .run-status-icon.danger { color: var(--danger); }
    .run-status-icon.warning { color: var(--accent); }
    .run-status-icon.muted { color: var(--fg-muted); }
    .run-breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
        flex-wrap: wrap;
    }
    .crumb-link {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
    }
    .crumb-link:hover {
        text-decoration: underline;
    }
    .crumb-sep {
        color: var(--border);
        font-size: 0.75rem;
    }
    .crumb-current {
        color: var(--fg);
        font-weight: 600;
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
    .run-summary {
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-top: 0.2rem;
        line-height: 1.3;
    }
    .run-error {
        font-size: 0.8rem;
        color: var(--danger);
        margin-top: 0.4rem;
    }
</style>

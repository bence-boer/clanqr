<script lang="ts">
    import { resolve } from '$app/paths';
    import type { AgentSession } from '$lib/types';

    interface Props {
        run: AgentSession
        format_duration: (ms: number | null) => string
        format_datetime: (date_str: string | null) => string
        get_tokens: (run: AgentSession) => number
    }

    let { run, format_duration, format_datetime, get_tokens }: Props = $props();
</script>

<tr class="detail-row">
    <td colspan="6">
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Model</span>
                <span class="detail-value">{run.model ?? 'default'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Prompt Tokens</span>
                <span class="detail-value">{(run.prompt_tokens ?? 0).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Completion Tokens</span>
                <span class="detail-value">{(run.completion_tokens ?? 0).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total Tokens</span>
                <span class="detail-value">{get_tokens(run).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Started</span>
                <span class="detail-value">{format_datetime(run.created_at)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Duration</span>
                <span class="detail-value">{format_duration(run.duration_ms)}</span>
            </div>
            {#if run.error}
                <div class="detail-item detail-error">
                    <span class="detail-label">Error</span>
                    <span class="detail-value error-text">{run.error}</span>
                </div>
            {/if}
            {#if run.task_id}
                <div class="detail-item">
                    <span class="detail-label">Task</span>
                    <a href={resolve('/projects')} class="detail-link">{run.task_id}</a>
                </div>
            {/if}
        </div>
    </td>
</tr>

<style>
    .detail-row td { padding: 0 !important; border-bottom: 1px solid var(--border); }
    .detail-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.75rem; padding: 1rem 1.25rem;
        background: var(--bg); border-top: 1px solid var(--border);
    }
    .detail-item { display: flex; flex-direction: column; gap: 0.15rem; }
    .detail-item.detail-error { grid-column: 1 / -1; }
    .detail-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); font-weight: 600; }
    .detail-value { font-size: 0.82rem; color: var(--fg); font-variant-numeric: tabular-nums; }
    .error-text { color: var(--danger); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.78rem; word-break: break-word; }
    .detail-link { font-size: 0.82rem; color: var(--accent); text-decoration: none; font-family: 'SF Mono', 'Fira Code', monospace; }
    .detail-link:hover { text-decoration: underline; }
</style>

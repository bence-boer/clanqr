<script lang="ts">
    import type { TaskRow } from '$lib/types';

    interface Props {
        tasks: TaskRow[]
    }

    let { tasks }: Props = $props();

    const total = $derived(tasks.length);
    const completed = $derived(tasks.filter((t) => t.status === 'complete').length);
    const failed = $derived(tasks.filter((t) => t.status === 'failed').length);
    const in_progress = $derived(tasks.filter((t) => t.status === 'in_progress').length);
    const pending_approval = $derived(tasks.filter((t) => t.status === 'queued').length);
    const other = $derived(total - completed - failed - in_progress - pending_approval);

    function pct(count: number): string {
        if (total === 0) return '0%';
        return `${(count / total) * 100}%`;
    }
</script>

{#if total > 0}
    <div class="progress-section">
        <div class="progress-bar"
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
        >
            {#if completed > 0}
                <div class="progress-segment complete" style="width:{pct(completed)}" title="{completed} complete"></div>
            {/if}
            {#if failed > 0}
                <div class="progress-segment failed" style="width:{pct(failed)}" title="{failed} failed"></div>
            {/if}
            {#if in_progress > 0}
                <div class="progress-segment in-progress" style="width:{pct(in_progress)}" title="{in_progress} in progress"></div>
            {/if}
            {#if pending_approval > 0}
                <div class="progress-segment pending-approval" style="width:{pct(pending_approval)}" title="{pending_approval} pending approval"></div>
            {/if}
            {#if other > 0}
                <div class="progress-segment other" style="width:{pct(other)}" title="{other} other"></div>
            {/if}
        </div>
        <span class="progress-label">{completed}/{total} tasks complete</span>
    </div>
{/if}

<style>
    .progress-section { margin-bottom: 1rem; }
    .progress-bar {
        display: flex; height: 8px; border-radius: 4px; overflow: hidden;
        background: var(--border); margin-bottom: 0.35rem;
    }
    .progress-segment { height: 100%; transition: width 0.3s ease; }
    .progress-segment.complete { background: var(--success); }
    .progress-segment.failed { background: var(--danger); }
    .progress-segment.in-progress { background: var(--info); }
    .progress-segment.pending-approval { background: var(--warning); }
    .progress-segment.other { background: var(--fg-muted); }
    .progress-label { font-size: 0.75rem; color: var(--fg-muted); }
</style>

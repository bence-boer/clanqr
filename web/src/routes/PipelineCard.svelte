<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import { resolve } from '$app/paths';
    import type { PipelineStatus } from '$lib/types';

    let {
        pipeline,
        onpause,
        onresume
    }: {
        pipeline: PipelineStatus | null
        onpause: () => void
        onresume: () => void
    } = $props();

    function pipeline_state_label(state: string) {
        if (state === 'running') return 'Running';
        if (state === 'paused') return 'Paused';
        return 'Idle';
    }

    function pipeline_state_color(state: string) {
        if (state === 'running') return '#6ea8fe';
        if (state === 'paused') return 'var(--accent)';
        return 'var(--fg-muted)';
    }
</script>

{#if pipeline}
    <section class="section">
        <div class="section-header">
            <h3>Pipeline</h3>
            <a href={resolve('/pipeline')} class="btn-link">View details →</a>
        </div>
        <div class="pipeline-card">
            <div class="pipeline-state" style="color: {pipeline_state_color(pipeline.state)}">
                <span class="icon"
                    >{pipeline.state === 'running' ? 'play_circle' : pipeline.state === 'paused' ? 'pause_circle' : 'radio_button_unchecked'}</span
                >
                {pipeline_state_label(pipeline.state)}
            </div>
            <div class="pipeline-meta">
                <span class="icon meta-icon">queue</span>
                {pipeline.queue_depth} task{pipeline.queue_depth !== 1 ? 's' : ''} queued
            </div>
            <div class="pipeline-actions">
                {#if pipeline.state === 'running'}
                    <Button size="sm" icon="pause" onclick={onpause}>Pause</Button>
                {:else if pipeline.state === 'paused'}
                    <Button variant="primary" size="sm" icon="play_arrow" onclick={onresume}>Resume</Button>
                {:else if pipeline.queue_depth > 0}
                    <a href={resolve('/pipeline')} style="text-decoration:none"><Button variant="primary" size="sm" icon="play_arrow">View Queue</Button></a>
                {/if}
            </div>
        </div>
    </section>
{/if}

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .section-header h3 {
        font-size: 1.05rem;
        color: var(--fg);
        margin: 0;
    }

    .btn-link {
        color: var(--accent);
        text-decoration: none;
        font-size: 0.875rem;
    }

    .pipeline-card {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem 1.25rem;
        flex-wrap: wrap;
    }

    .pipeline-state {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
    }

    .pipeline-meta {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.875rem;
        color: var(--fg-muted);
    }

    .meta-icon {
        font-size: 16px;
    }

    .pipeline-actions {
        margin-left: auto;
    }
</style>

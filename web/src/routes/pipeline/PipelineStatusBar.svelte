<script lang="ts">
    import { Button, Badge } from '$lib/components/primitives';
    import type { PipelineStatus } from '$lib/types';

    let {
        pipeline,
        action_busy,
        action_error,
        on_pause,
        on_resume,
        on_stop
    }: {
        pipeline: PipelineStatus | null
        action_busy: boolean
        action_error: string
        on_pause: () => void
        on_resume: () => void
        on_stop: () => void
    } = $props();

    // §14.5 — Debounce action buttons (1s cooldown)
    let debounced = $state(false);

    function with_debounce(action: () => void) {
        return () => {
            action();
            debounced = true;
            setTimeout(() => {
                debounced = false;
            }, 1000);
        };
    }

    const buttons_disabled = $derived(action_busy || debounced);

    function state_icon(state: string) {
        if (state === 'running') return 'play_circle';
        if (state === 'paused') return 'pause_circle';
        return 'radio_button_unchecked';
    }

    function state_label(state: string) {
        if (state === 'running') return 'Running';
        if (state === 'paused') return 'Paused';
        return 'Idle';
    }

    function state_class(state: string) {
        if (state === 'running') return 'running';
        if (state === 'paused') return 'paused';
        return 'idle';
    }
</script>

<div class="status-bar" class:running={pipeline?.state === 'running'} class:paused={pipeline?.state === 'paused'} role="status" aria-live="polite">
    <div class="status-left">
        <span class="icon state-icon">{state_icon(pipeline?.state ?? 'idle')}</span>
        <span class={['state-label', state_class(pipeline?.state ?? 'idle')].join(' ')}>
            {state_label(pipeline?.state ?? 'idle')}
        </span>
        {#if pipeline && pipeline.queue_depth > 0}
            <Badge variant="muted">{pipeline.queue_depth} queued</Badge>
        {/if}
    </div>
    <div class="status-right">
        {#if action_error}
            <span class="action-error">{action_error}</span>
        {/if}
        {#if pipeline?.state === 'running'}
            <Button variant="secondary" size="sm" icon="pause" onclick={with_debounce(on_pause)} disabled={buttons_disabled}>Pause</Button>
            <Button variant="danger" size="sm" icon="stop" onclick={with_debounce(on_stop)} disabled={buttons_disabled}>Stop Task</Button>
        {:else if pipeline?.state === 'paused'}
            <Button variant="primary" size="sm" icon="play_arrow" onclick={with_debounce(on_resume)} disabled={buttons_disabled}>Resume</Button>
        {:else}
            <Button variant="primary" size="sm" icon="play_arrow" onclick={with_debounce(on_resume)} disabled={buttons_disabled}>Start Pipeline</Button>
        {/if}
    </div>
</div>

<style>
    .status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.25rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }

    .status-bar.running {
        border-color: var(--success);
    }
    .status-bar.paused {
        border-color: var(--accent);
    }

    .status-left,
    .status-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .state-icon {
        font-size: 22px;
        color: var(--fg-muted);
    }
    .status-bar.running .state-icon {
        color: var(--success);
    }
    .status-bar.paused .state-icon {
        color: var(--accent);
    }

    .state-label {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--fg-muted);
    }
    .state-label.running {
        color: var(--success);
    }
    .state-label.paused {
        color: var(--accent);
    }

    .action-error {
        font-size: 0.8rem;
        color: var(--danger);
    }

    @media (max-width: 768px) {
        .status-bar {
            flex-direction: column;
            align-items: flex-start;
        }
        .status-right {
            width: 100%;
            justify-content: flex-end;
            flex-wrap: wrap;
        }
    }
</style>

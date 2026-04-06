<script lang="ts">
    export interface WaveInfo {
        wave: number;
        status: 'completed' | 'running' | 'pending' | 'failed';
        task_count: number;
    }

    let {
        waves,
        compact = false
    }: {
        waves: WaveInfo[]
        compact?: boolean
    } = $props();

    function status_icon(status: string): string {
        if (status === 'completed') return 'check_circle';
        if (status === 'running') return 'sync';
        if (status === 'failed') return 'error';
        return 'radio_button_unchecked';
    }

    function status_class(status: string): string {
        if (status === 'completed') return 'wave-completed';
        if (status === 'running') return 'wave-running';
        if (status === 'failed') return 'wave-failed';
        return 'wave-pending';
    }
</script>

{#if waves.length > 0}
    <div class="wave-progress" class:compact>
        {#each waves as wave, i (wave.wave)}
            {#if i > 0}
                <div class="wave-connector" class:done={waves[i - 1].status === 'completed'}></div>
            {/if}
            <div class="wave-pill {status_class(wave.status)}" title="Wave {wave.wave}: {wave.task_count} tasks">
                <span class="icon" class:spin={wave.status === 'running'} style="font-size:14px">
                    {status_icon(wave.status)}
                </span>
                {#if !compact}
                    <span class="wave-label">W{wave.wave}</span>
                    <span class="wave-count">{wave.task_count}</span>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .wave-progress {
        display: flex;
        align-items: center;
        gap: 0;
    }

    .wave-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid var(--border);
        background: var(--bg-surface);
        color: var(--fg-muted);
    }

    .wave-completed {
        border-color: var(--success);
        color: var(--success);
    }

    .wave-running {
        border-color: var(--accent);
        color: var(--accent);
    }

    .wave-failed {
        border-color: var(--danger);
        color: var(--danger);
    }

    .wave-connector {
        width: 20px;
        height: 2px;
        background: var(--border);
        flex-shrink: 0;
    }

    .wave-connector.done {
        background: var(--success);
    }

    .wave-count {
        opacity: 0.7;
        font-size: 0.6rem;
    }

    .compact .wave-pill {
        padding: 0.15rem 0.3rem;
    }

    .compact .wave-connector {
        width: 12px;
    }
</style>

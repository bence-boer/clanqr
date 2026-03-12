<script lang="ts">
    import { Button } from '$lib/components/primitives';

    interface Props {
        refreshing: boolean
        refresh_message: string | null
        on_refresh: () => void
    }

    let { refreshing, refresh_message, on_refresh }: Props = $props();
</script>

<div class="page-header">
    <div class="header-left">
        <h2>Skills</h2>
        <p class="subtitle">Copilot CLI skills available on this system (from ~/.copilot/skills/)</p>
    </div>
    <div class="header-right">
        {#if refresh_message}
            <span class="refresh-msg">{refresh_message}</span>
        {/if}
        <Button variant="secondary" icon={refreshing ? 'progress_activity' : 'refresh'} onclick={on_refresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh Skills'}
        </Button>
    </div>
</div>

<style>
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
    }

    .header-left h2 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--fg);
        margin: 0 0 0.25rem;
    }

    .subtitle {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin: 0;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
    }

    .refresh-msg {
        font-size: 0.82rem;
        color: var(--accent);
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid rgba(212, 175, 55, 0.25);
        border-radius: var(--radius);
        padding: 0.3rem 0.65rem;
    }

    @media (max-width: 600px) {
        .page-header {
            flex-direction: column;
        }
    }
</style>

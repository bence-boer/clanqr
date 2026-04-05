<script lang="ts">
    import type { MaterialSymbol } from '$lib/types';

    type Variant = 'error' | 'warning' | 'info' | 'stale';

    interface Props {
        variant?: Variant
        icon?: MaterialSymbol
        message: string
    }

    const { variant = 'error', icon, message }: Props = $props();

    const default_icons: Record<Variant, MaterialSymbol> = {
        error: 'error',
        warning: 'warning',
        info: 'info',
        stale: 'warning'
    };

    const resolved_icon = $derived(icon ?? default_icons[variant]);
</script>

<div class="error-banner variant-{variant}" role="alert">
    <span class="icon banner-icon">{resolved_icon}</span>
    <span class="banner-message">{message}</span>
</div>

<style>
    .error-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: var(--radius);
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }

    .banner-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .variant-error {
        background: rgba(var(--danger-rgb), 0.1);
        border: 1px solid rgba(var(--danger-rgb), 0.3);
        color: var(--danger);
    }

    .variant-warning {
        background: var(--accent-dim);
        border: 1px solid rgba(var(--accent-rgb), 0.3);
        color: var(--accent);
    }

    .variant-info {
        background: rgba(var(--info-rgb), 0.1);
        border: 1px solid rgba(var(--info-rgb), 0.3);
        color: var(--info);
    }

    .variant-stale {
        background: var(--accent-dim);
        border: 1px solid rgba(var(--accent-rgb), 0.3);
        color: var(--accent);
        font-size: 0.8rem;
    }
</style>

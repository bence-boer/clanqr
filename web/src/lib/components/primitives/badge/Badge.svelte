<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    type Variant = 'default' | 'muted' | 'info' | 'warning' | 'success' | 'danger';

    let {
        variant = 'default',
        class: class_name = '',
        icon,
        children,
        ...rest_props
    }: HTMLAttributes<HTMLSpanElement> & {
        variant?: Variant;
        icon?: string;
        children?: Snippet;
    } = $props();

    const variant_classes = {
        default: 'badge-default',
        muted: 'badge-muted',
        info: 'badge-info',
        warning: 'badge-warning',
        success: 'badge-success',
        danger: 'badge-danger'
    };
</script>

<span {...rest_props} class="badge {variant_classes[variant]} {class_name}">
    {#if icon}
        <span class="icon" style="font-size:11px">{icon}</span>
    {/if}
    {#if children}
        {@render children()}
    {/if}
</span>

<style>
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.2;
        white-space: nowrap;
    }

    .badge-default {
        background: var(--bg-elevated);
        color: var(--fg);
    }

    .badge-muted {
        background: rgba(158, 151, 138, 0.15);
        color: var(--fg-muted);
    }

    .badge-info {
        background: rgba(106, 168, 254, 0.15);
        color: #6ea8fe;
    }

    .badge-warning {
        background: var(--accent-dim);
        color: var(--accent);
    }

    .badge-success {
        background: rgba(74, 158, 110, 0.15);
        color: var(--success);
    }

    .badge-danger {
        background: rgba(201, 84, 74, 0.15);
        color: var(--danger);
    }
</style>

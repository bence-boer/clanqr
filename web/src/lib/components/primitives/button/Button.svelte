<script lang="ts">
    import type { MaterialSymbol } from '$lib/types';
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { Icon } from '../icon';

    export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'tab' | 'filter';
    export type ButtonSize = 'default' | 'sm' | 'icon';

    export type ButtonProperties = HTMLButtonAttributes & {
        ref?: HTMLButtonElement | null
        variant?: ButtonVariant
        size?: ButtonSize
        icon?: MaterialSymbol
        loading?: boolean
        active?: boolean
        children?: Snippet
    };

    let {
        ref = $bindable(null),
        variant = 'default',
        size = 'default',
        icon,
        loading = false,
        active = false,
        class: class_name,
        children,
        ...rest_props
    }: ButtonProperties = $props();

    const variant_classes: Record<ButtonVariant, string> = {
        default: 'btn-default',
        primary: 'btn-primary',
        secondary: 'btn-default',
        danger: 'btn-danger',
        ghost: 'btn-ghost',
        tab: 'btn-tab',
        filter: 'btn-filter'
    };

    const size_classes: Record<ButtonSize, string> = {
        default: 'size-default',
        sm: 'size-sm',
        icon: 'size-icon'
    };
</script>

<button
    {...rest_props}
    bind:this={ref}
    disabled={rest_props.disabled || loading}
    data-slot="button"
    class={['base-btn', variant_classes[variant], size_classes[size], active ? 'active' : '', class_name].filter(Boolean).join(' ')}
>
    {#if loading}
        <Icon type="progress_activity" />
    {:else if icon}
        <Icon type={icon} />
    {/if}
    {#if children}
        {@render children()}
    {/if}
</button>

<style>
    .base-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border-radius: var(--radius);
        font-family: var(--font);
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid transparent;
        line-height: 1;
        white-space: nowrap;
    }

    .base-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .base-btn:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    /* Variants */
    .btn-default {
        border-color: var(--border);
        background: var(--bg-elevated);
        color: var(--fg);
        font-size: 0.8rem;
    }
    .btn-default:hover:not(:disabled) {
        background: var(--bg-surface);
    }

    .btn-primary {
        background: var(--accent);
        color: var(--bg);
        border: none;
        font-weight: 600;
        font-size: 0.875rem;
    }
    .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
    }

    .btn-danger {
        background: transparent;
        color: var(--danger);
        border-color: var(--danger);
        font-size: 0.8rem;
    }
    .btn-danger:hover:not(:disabled) {
        background: var(--danger);
        color: var(--fg);
    }

    .btn-ghost {
        background: none;
        color: var(--fg-muted);
        border: none;
    }
    .btn-ghost:hover:not(:disabled) {
        color: var(--fg);
        background: var(--bg-elevated);
    }

    .btn-tab {
        background: transparent;
        border-radius: 0;
        border-bottom: 2px solid transparent;
        color: var(--fg-muted);
        padding: 0.65rem 1.1rem;
        font-weight: 500;
        margin-bottom: -1px;
    }
    .btn-tab:hover:not(:disabled) {
        color: var(--fg);
    }
    .btn-tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
    }

    .btn-filter {
        background: transparent;
        border: 1px solid transparent;
        color: var(--fg-muted);
        border-radius: 20px;
        padding: 0.35rem 0.85rem;
    }
    .btn-filter:hover:not(:disabled) {
        background: var(--bg-elevated);
        color: var(--fg);
    }
    .btn-filter.active {
        background: var(--bg-elevated);
        border-color: var(--border);
        color: var(--fg);
        font-weight: 500;
    }

    /* Sizes */
    .size-default {
        padding: 0.5rem 1rem;
    }
    .btn-primary.size-default {
        padding: 0.65rem 1.25rem;
    }

    .size-sm {
        padding: 0.35rem 0.65rem;
        font-size: 0.75rem;
    }

    .size-icon {
        padding: 0.5rem;
        min-width: 2.75rem;
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    /* Icon scaling relative to size */
    :global(.base-btn.size-sm .btn-icon) {
        font-size: 16px;
    }
    :global(.base-btn.size-default .btn-icon) {
        font-size: 20px;
    }
</style>

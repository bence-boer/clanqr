<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        ref?: HTMLDivElement | null
        label: string
        open?: boolean
        children?: Snippet
    }

    let {
        ref = $bindable(null),
        class: class_name,
        label,
        open = $bindable(false),
        children,
        ...rest_props
    }: Props = $props();

    const content_id = `accordion-content-${Math.random().toString(36).slice(2, 10)}`;
</script>

<div
    bind:this={ref}
    data-open={open}
    data-slot="accordion"
    class={['accordion', class_name].filter(Boolean).join(' ')}
    {...rest_props}
>
    <button
        type="button"
        class="accordion-toggle"
        aria-expanded={open}
        aria-controls={content_id}
        onclick={() => {
            open = !open;
        }}
    >
        <span class="accordion-label">{label}</span>
        <span class="icon accordion-icon">expand_more</span>
    </button>

    {#if open}
        <div id={content_id} class="accordion-content" data-slot="accordion-content">
            {@render children?.()}
        </div>
    {/if}
</div>

<style>
    .accordion {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
        overflow: hidden;
    }

    .accordion-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 0.9rem;
        background: transparent;
        color: var(--fg);
        border: 0;
        cursor: pointer;
        text-align: left;
        font: inherit;
    }

    .accordion-toggle:hover {
        background: var(--bg-surface);
    }

    .accordion-label {
        font-size: 0.85rem;
        font-weight: 600;
    }

    .accordion-icon {
        font-size: 18px;
        color: var(--fg-muted);
        transition: transform 0.15s ease;
        flex-shrink: 0;
    }

    .accordion[data-open='true'] .accordion-icon {
        transform: rotate(180deg);
    }

    .accordion-content {
        padding: 0.9rem;
        border-top: 1px solid var(--border);
        background: var(--bg);
    }
</style>

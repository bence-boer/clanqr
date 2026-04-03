<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLSelectAttributes } from 'svelte/elements';
    import { Label, type LabelProperties } from '../label';
    import { generate_id } from '$lib/utils/id';

    export type SelectProperties = HTMLSelectAttributes & {
        ref?: HTMLSelectElement | null
        value?: unknown
        label?: string
        id?: string
        required?: LabelProperties['required']
        children?: Snippet
    };

    let {
        ref = $bindable(null),
        value = $bindable(),
        class: class_name,
        label,
        id,
        required,
        style,
        children,
        ...rest_props
    }: SelectProperties = $props();

    const fallback_id = `select-${generate_id().slice(0, 8)}`;
    const select_id = $derived(id || fallback_id);
</script>

<div class={['select', class_name].filter(Boolean).join(' ')} {style}>
    {#if label}
        <Label for={select_id} {required}>
            {label}
        </Label>
    {/if}
    <select
        {...rest_props}
        {required}
        id={select_id}
        data-slot="select"
        bind:this={ref}
        bind:value
        class="base-select"
    >
        {@render children?.()}
    </select>
</div>

<style>
    .select {
        display: flex;
        flex-direction: column;
    }

    .base-select {
        appearance: none;
        background-color: var(--bg, #fff);
        border: 1px solid var(--border, #ccc);
        border-radius: var(--radius, 4px);
        color: var(--fg, #333);
        font-family: var(--font, inherit);
        font-size: 0.875rem;
        padding: 0.5rem 2rem 0.5rem 0.75rem;
        width: 100%;
        outline: none;
        transition: border-color 0.15s;
        cursor: pointer;

        /* Custom Chevron */
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
    }

    .base-select:focus:not(:focus-visible) {
        outline: none;
    }

    .base-select:focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25);
    }

    .base-select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLLabelAttributes } from 'svelte/elements';

    export type LabelProperties = HTMLLabelAttributes & {
        ref?: HTMLLabelElement | null
        children?: Snippet
        required?: boolean
    };

    let {
        ref = $bindable(null),
        children,
        class: class_name,
        required = false,
        ...rest_props
    }: LabelProperties = $props();
</script>

<label {...rest_props} data-slot="label" bind:this={ref} class={['base-label', class_name].filter(Boolean).join(' ')}>
    {@render children?.()}
    {#if required}
        <span class="required-indicator">*</span>
    {/if}
</label>

<style>
    .base-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--fg-muted);
        margin-bottom: 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .required-indicator {
        color: var(--danger, #ef4444);
        margin-left: 0.2rem;
    }
</style>

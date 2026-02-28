<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';
    import type { Snippet } from 'svelte';
    import { Label } from '../label';

    let {
        ref = $bindable(null),
        value = $bindable(),
        class: class_name,
        label,
        labelSnippet,
        id,
        required,
        type = 'text',
        ...rest_props
    }: HTMLInputAttributes & {
        ref?: HTMLInputElement | null;
        value?: any;
        label?: string;
        labelSnippet?: Snippet;
        id?: string;
        required?: boolean;
    } = $props();

    const input_id = $derived(id || `input-${Math.random().toString(36).slice(2, 9)}`);
</script>

<div class="input">
    {#if label || labelSnippet}
        <Label for={input_id} required={Boolean(required)}>
            {#if labelSnippet}
                {@render labelSnippet()}
            {:else}
                {label}
            {/if}
        </Label>
    {/if}

    <input
        {...rest_props}
        {type}
        {required}
        id={input_id}
        data-slot="input"
        bind:this={ref}
        bind:value
        class={['base-input', class_name].filter(Boolean).join(' ')}
    />
</div>

<style>
    .input {
        display: flex;
        flex-direction: column;
    }

    .base-input {
        background-color: var(--bg, #fff);
        border: 1px solid var(--border, #ccc);
        border-radius: var(--radius, 4px);
        color: var(--fg, #333);
        font-family: var(--font, inherit);
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
        width: 100%;
        outline: none;
        transition: border-color 0.15s;
    }

    .base-input:focus {
        border-color: var(--accent, #0066cc);
    }

    .base-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>

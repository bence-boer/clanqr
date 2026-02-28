<script lang="ts">
    import type { HTMLTextareaAttributes } from 'svelte/elements';
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
        ...rest_props
    }: HTMLTextareaAttributes & {
        ref?: HTMLTextAreaElement | null;
        value?: any;
        label?: string;
        labelSnippet?: Snippet;
        id?: string;
        required?: boolean;
    } = $props();

    const textarea_id = $derived(id || `textarea-${Math.random().toString(36).slice(2, 9)}`);
</script>

<div class="textarea">
    {#if label || labelSnippet}
        <Label for={textarea_id} required={Boolean(required)}>
            {#if labelSnippet}
                {@render labelSnippet()}
            {:else}
                {label}
            {/if}
        </Label>
    {/if}

    <textarea
        {...rest_props}
        {required}
        id={textarea_id}
        data-slot="textarea"
        bind:this={ref}
        bind:value
        class={['base-textarea', class_name].filter(Boolean).join(' ')}
    ></textarea>
</div>

<style>
    .textarea {
        display: flex;
        flex-direction: column;
    }

    .base-textarea {
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
        resize: vertical;
        min-height: 60px;
    }

    .base-textarea:focus {
        border-color: var(--accent, #0066cc);
    }

    .base-textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>

<script lang="ts">
    import { Button, Input, Textarea } from '$lib/components/primitives';

    interface Props {
        show: boolean
        new_name: string
        new_description: string
        creating: boolean
        on_create: () => void
    }

    let {
        show, new_name = $bindable(), new_description = $bindable(),
        creating, on_create
    }: Props = $props();
</script>

{#if show}
    <form
        class="create-form"
        onsubmit={(event) => {
            event.preventDefault();
            on_create();
        }}
    >
        <Input type="text" placeholder="Project name" bind:value={new_name} class="input" required aria-label="Project name" />
        <Textarea placeholder="Description (optional)" bind:value={new_description} rows={2} aria-label="Project description" />
        <Button type="submit" variant="primary" disabled={creating || !new_name.trim()}>
            {creating ? 'Creating...' : 'Create Project'}
        </Button>
    </form>
{/if}

<style>
    .create-form {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
</style>

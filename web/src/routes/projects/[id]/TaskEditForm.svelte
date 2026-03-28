<script lang="ts">
    import { Button, Input } from '$lib/components/primitives';

    interface Props {
        title: string
        description: string
        saving: boolean
        on_save: () => Promise<void>
        on_cancel: () => void
    }

    let {
        title = $bindable(), description = $bindable(),
        saving, on_save, on_cancel
    }: Props = $props();
</script>

<div class="task-edit-form">
    <Input
        class="task-input"
        type="text"
        placeholder="Task title (optional)"
        bind:value={title}
        onkeydown={(event) => {
            if (event.key === 'Enter') on_save();
            if (event.key === 'Escape') on_cancel();
        }}
    />
    <textarea
        class="task-desc-input"
        placeholder="Task description…"
        bind:value={description}
        rows="4"
        onkeydown={(event) => {
            if (event.key === 'Escape') on_cancel();
        }}
    ></textarea>
    <div class="task-edit-actions">
        <Button variant="primary" size="sm" onclick={on_save} disabled={saving}>Save</Button>
        <Button variant="secondary" size="sm" onclick={on_cancel}>Cancel</Button>
    </div>
</div>

<style>
    .task-edit-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: var(--bg); border: 1px solid var(--accent);
        border-radius: var(--radius); padding: 0.75rem;
    }
    .task-desc-input {
        width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--bg); color: var(--fg); font-size: 0.85rem; font-family: inherit;
        resize: vertical; line-height: 1.5;
    }
    .task-edit-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>

<script lang="ts">
    import { Button, Input, Textarea } from '$lib/components/primitives';
    import type { Feature } from '$lib/types';

    interface Props {
        feature: Feature
        on_save: (data: {
            title: string
            description: string | null
        }) => Promise<void>
        on_cancel: () => void
    }

    let { feature, on_save, on_cancel }: Props = $props();

    let edit_title = $state(feature.title);
    let edit_description = $state(feature.description ?? '');
    let saving = $state(false);
    let started_at = feature.updated_at;

    const save_disabled = $derived(saving || !edit_title.trim());

    async function handle_save(e?: Event) {
        e?.preventDefault();
        if (!edit_title.trim()) return;
        if (started_at && feature.updated_at !== started_at) {
            if (!confirm('This feature was modified elsewhere. Save anyway?')) return;
        }
        saving = true;
        try {
            await on_save({
                title: edit_title.trim(), description: edit_description.trim() || null
            });
        }
        finally {
            saving = false;
        }
    }
</script>

<form class="edit-feature-form" onsubmit={handle_save}>
    <Input id="edit-title" type="text" bind:value={edit_title} label="Title" required />
    <Textarea id="edit-desc" bind:value={edit_description} label="Description" rows={4} />
    <div class="form-actions">
        <Button type="button" variant="secondary" size="sm" onclick={on_cancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={save_disabled}>
            {saving ? 'Saving...' : 'Save'}
        </Button>
    </div>
</form>

<style>
    .edit-feature-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>

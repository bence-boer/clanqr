<script lang="ts">
    import { api } from '$lib/api/client';
    import { Button, Input, Select, Textarea } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature } from '$lib/types';
    import { onMount } from 'svelte';

    interface Props {
        feature: Feature
        on_save: (data: {
            title: string
            description: string | null
            planning_model: string | null
            execution_model: string | null
        }) => Promise<void>
        on_cancel: () => void
    }

    let { feature, on_save, on_cancel }: Props = $props();

    type ModelOpt = { value: string, label: string };
    let edit_title = $state(feature.title);
    let edit_description = $state(feature.description ?? '');
    let edit_planning_model = $state(feature.planning_model ?? '');
    let edit_execution_model = $state(feature.execution_model ?? '');
    let model_options = $state<ModelOpt[]>([]);
    let loading_models = $state(false);
    let saving = $state(false);
    let models_loaded = $state(false);
    let started_at = feature.updated_at;

    const plan_label = $derived(`Planning Model ${loading_models ? '(...)' : ''}`);
    const exec_label = $derived(`Execution Model ${loading_models ? '(...)' : ''}`);
    const save_disabled = $derived(saving || !edit_title.trim() || !edit_planning_model || !edit_execution_model);

    async function load_models() {
        if (models_loaded) return;
        loading_models = true;
        try {
            model_options = await api.list_models();
            models_loaded = true;
            if (!model_options.find((m) => m.value === edit_planning_model) && model_options.length > 0) edit_planning_model = model_options[0].value;
            if (!model_options.find((m) => m.value === edit_execution_model) && model_options.length > 0) edit_execution_model = model_options[0].value;
        }
        catch (error) {
            console.error(error);
            toast_store.error('Failed to load models');
        }
        finally {
            loading_models = false;
        }
    }

    onMount(() => {
        load_models();
    });

    async function handle_save(e?: Event) {
        e?.preventDefault();
        if (!edit_title.trim()) return;
        if (started_at && feature.updated_at !== started_at) {
            if (!confirm('This feature was modified elsewhere. Save anyway?')) return;
        }
        saving = true;
        try {
            await on_save({
                title: edit_title.trim(), description: edit_description.trim() || null,
                planning_model: edit_planning_model || null, execution_model: edit_execution_model || null
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
    <div class="selection-grid">
        <div class="field">
        <Select id="edit-planning-model" label={plan_label} bind:value={edit_planning_model} disabled={loading_models}>
            {#each model_options as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
        </Select></div>
        <div class="field">
        <Select id="edit-execution-model" label={exec_label} bind:value={edit_execution_model} disabled={loading_models}>
            {#each model_options as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
        </Select></div>
    </div>
    <div class="form-actions">
        <Button type="button" variant="secondary" size="sm" onclick={on_cancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={save_disabled}>
            {saving ? 'Saving...' : 'Save'}
        </Button>
    </div>
</form>

<style>
    .edit-feature-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
    .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    @media (max-width: 768px) {
        .selection-grid { grid-template-columns: 1fr; }
    }
</style>

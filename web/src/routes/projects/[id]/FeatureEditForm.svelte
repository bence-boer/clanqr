<script lang="ts">
    import { api } from '$lib/api/client';
    import { Button, Input, Select, Textarea } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature } from '$lib/types';

    interface Props {
        feature: Feature
        on_save: (data: {
            title: string
            description: string | null
            cli: string
            execution_cli: string
            planning_model: string | null
            execution_model: string | null
        }) => Promise<void>
        on_cancel: () => void
    }

    let { feature, on_save, on_cancel }: Props = $props();

    type ModelOpt = { value: string, label: string };
    let edit_title = $state(feature.title);
    let edit_description = $state(feature.description ?? '');
    let edit_cli = $state(feature.cli ?? 'copilot');
    let edit_execution_cli = $state(feature.execution_cli ?? feature.cli ?? 'copilot');
    let edit_planning_model = $state(feature.planning_model ?? '');
    let edit_execution_model = $state(feature.execution_model ?? '');
    let edit_planning_models = $state<ModelOpt[]>([]);
    let edit_execution_models = $state<ModelOpt[]>([]);
    let loading_planning = $state(false);
    let loading_execution = $state(false);
    let saving = $state(false);
    let last_plan_cli = $state('');
    let last_exec_cli = $state('');
    let started_at = feature.updated_at;

    const plan_label = $derived(`Planning Model ${loading_planning ? '(...)' : ''}`);
    const exec_label = $derived(`Execution Model ${loading_execution ? '(...)' : ''}`);
    const save_disabled = $derived(saving || !edit_title.trim() || !edit_planning_model || !edit_execution_model);

    async function load_models(cli_val: string, kind: 'planning' | 'execution') {
        const is_plan = kind === 'planning';
        if (cli_val === (is_plan ? last_plan_cli : last_exec_cli)) return;
        if (is_plan) loading_planning = true;
        else loading_execution = true;
        try {
            const result = await api.list_models(cli_val);
            if (is_plan) {
                edit_planning_models = result;
                last_plan_cli = cli_val;
                if (!result.find((m) => m.value === edit_planning_model) && result.length > 0) edit_planning_model = result[0].value;
            }
            else {
                edit_execution_models = result;
                last_exec_cli = cli_val;
                if (!result.find((m) => m.value === edit_execution_model) && result.length > 0) edit_execution_model = result[0].value;
            }
        }
        catch {
            toast_store.error(`Failed to load ${kind} models`);
        }
        finally {
            if (is_plan) loading_planning = false;
            else loading_execution = false;
        }
    }

    $effect(() => {
        load_models(edit_cli, 'planning');
        load_models(edit_execution_cli, 'execution');
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
                cli: edit_cli, execution_cli: edit_execution_cli,
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
        <div class="field"><Select id="edit-cli" label="Planning CLI" bind:value={edit_cli} class="input select">
            <option value="copilot">Copilot CLI</option><option value="gemini">Gemini CLI</option>
        </Select></div>
        <div class="field">
        <Select id="edit-planning-model" label={plan_label} bind:value={edit_planning_model} disabled={loading_planning}>
            {#each edit_planning_models as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
        </Select></div>
        <div class="field"><Select id="edit-execution-cli" label="Execution CLI" bind:value={edit_execution_cli} class="input select">
            <option value="copilot">Copilot CLI</option><option value="gemini">Gemini CLI</option>
        </Select></div>
        <div class="field">
        <Select id="edit-execution-model" label={exec_label} bind:value={edit_execution_model} disabled={loading_execution}>
            {#each edit_execution_models as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
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

<script lang="ts">
    import { onMount } from 'svelte';
    import { api } from '$lib/api/client';
    import { Button } from '$lib/components/primitives/button';
    import { Input } from '$lib/components/primitives/input';
    import { Select } from '$lib/components/primitives/select';
    import { Textarea } from '$lib/components/primitives/textarea';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { FailureBehavior } from '$lib/types';
    import type { CreateFeatureData } from './feature_actions';
    import FeatureAdvancedSettings from './FeatureAdvancedSettings.svelte';
    import FeatureResources from './FeatureResources.svelte';

    interface Props {
        on_create: (data: CreateFeatureData) => Promise<void>
        on_cancel: () => void
    }

    let { on_create, on_cancel }: Props = $props();

    type ModelOpt = { value: string, label: string };

    let title = $state('');
    let description = $state('');
    let planning_model = $state('');
    let execution_model = $state('');
    let on_task_failure = $state<FailureBehavior>('stop');
    let task_timeout_minutes = $state(10);
    let resources = $state<{ url: string, title: string }[]>([]);
    let creating = $state(false);
    let form_error = $state<string | null>(null);
    let model_options = $state<ModelOpt[]>([]);
    let loading_models = $state(true);

    onMount(async () => {
        try {
            model_options = await api.list_models();
            if (model_options.length > 0) {
                const default_model = model_options.find((m) => m.value === 'gpt-4.1');
                planning_model = default_model?.value ?? model_options[0].value;
                execution_model = default_model?.value ?? model_options[0].value;
            }
        }
        catch {
            toast_store.error('Failed to load models');
        }
        finally {
            loading_models = false;
        }
    });

    async function handle_submit() {
        if (!title.trim()) return;
        creating = true;
        form_error = null;
        try {
            const clean_resources = resources
                .filter((r) => r.url.trim())
                .map((r) => ({ url: r.url.trim(), title: r.title.trim() || undefined }));
            await on_create({
                title: title.trim(),
                description: description.trim() || undefined,
                planning_model: planning_model || null,
                execution_model: execution_model || null,
                on_task_failure,
                task_timeout_minutes,
                resources: clean_resources
            });
            title = '';
            description = '';
            planning_model = model_options[0]?.value ?? '';
            execution_model = model_options[0]?.value ?? '';
            on_task_failure = 'stop';
            task_timeout_minutes = 10;
            resources = [];
            form_error = null;
        }
        catch (error) {
            form_error = error instanceof Error
                ? error.message
                : 'Failed to create feature. Please try again.';
        }
        finally {
            creating = false;
        }
    }

    const plan_label = $derived(`Planning Model${loading_models ? ' (loading...)' : ''}`);
    const exec_label = $derived(`Execution Model${loading_models ? ' (loading...)' : ''}`);
</script>

<form
    class="create-form"
    onsubmit={(event) => {
        event.preventDefault();
        handle_submit();
    }}
>
    <Input type="text" placeholder="Feature title" bind:value={title} required />
    <Textarea placeholder="Description" bind:value={description} rows={4} />

    <div class="model-grid">
        <div class="field">
            <Select id="create-planning-model" label={plan_label} bind:value={planning_model} disabled={loading_models}>
                {#each model_options as m (m.value)}
                    <option value={m.value}>{m.label}</option>
                {/each}
            </Select>
            <span class="help-text">AI model that breaks your feature into tasks</span>
        </div>
        <div class="field">
            <Select id="create-execution-model" label={exec_label} bind:value={execution_model} disabled={loading_models}>
                {#each model_options as m (m.value)}
                    <option value={m.value}>{m.label}</option>
                {/each}
            </Select>
            <span class="help-text">AI model that implements each task</span>
        </div>
    </div>

    <FeatureResources bind:resources />

    <FeatureAdvancedSettings
        bind:on_task_failure
        bind:task_timeout_minutes
    />

    {#if form_error}
        <div class="form-error">
            <span class="icon" style="font-size:14px">error</span>
            {form_error}
        </div>
    {/if}

    <div class="form-actions">
        <Button type="button" variant="secondary" onclick={on_cancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={creating || !title.trim() || loading_models}>
            <span class="icon" style="font-size:16px">save</span>
            {creating ? 'Creating...' : 'Save Draft'}
        </Button>
    </div>
</form>

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
    .model-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .help-text {
        font-size: 0.7rem;
        color: var(--fg-muted);
        font-style: italic;
    }
    .form-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }
    .form-error {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        font-size: 0.8rem;
    }
    @media (max-width: 768px) {
        .model-grid { grid-template-columns: 1fr; }
    }
</style>

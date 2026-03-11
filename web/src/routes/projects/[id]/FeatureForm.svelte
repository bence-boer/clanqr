<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import { api } from '$lib/api/client';
    import { Input } from '$lib/components/primitives/input';
    import { Select } from '$lib/components/primitives/select';
    import { Textarea } from '$lib/components/primitives/textarea';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { FailureBehavior } from '$lib/types';
    import type { CreateFeatureData } from './feature_actions';

    interface ModelOption {
        value: string
        label: string
    }

    interface Props {
        on_create: (data: CreateFeatureData) => Promise<void>
        on_cancel: () => void
    }

    let { on_create, on_cancel }: Props = $props();

    let title = $state('');
    let description = $state('');
    let cli = $state('copilot');
    let execution_cli = $state('copilot');
    let planning_model = $state('');
    let execution_model = $state('');
    let on_task_failure = $state<FailureBehavior>('stop');
    let task_timeout_minutes = $state(10);
    let planning_models = $state<ModelOption[]>([]);
    let execution_models = $state<ModelOption[]>([]);
    let resources = $state<{ url: string, title: string }[]>([]);
    let creating = $state(false);
    let loading_planning = $state(false);
    let loading_execution = $state(false);
    let last_planning_cli = $state('');
    let last_execution_cli = $state('');
    let show_advanced = $state(false);
    let form_error = $state<string | null>(null);

    const plan_lbl = $derived(`Planning Model ${loading_planning ? '(loading...)' : ''}`);
    const exec_lbl = $derived(`Execution Model ${loading_execution ? '(loading...)' : ''}`);

    const is_default_planning = $derived.by(() => {
        if (!planning_models.length || !planning_model) return false;
        return planning_model === planning_models[0].value;
    });
    const is_default_execution = $derived.by(() => {
        if (!execution_models.length || !execution_model) return false;
        return execution_model === execution_models[0].value;
    });

    async function load_models_for(target_cli: string, kind: 'planning' | 'execution') {
        const is_planning = kind === 'planning';
        const last = is_planning ? last_planning_cli : last_execution_cli;
        if (target_cli === last) return;
        if (is_planning) loading_planning = true;
        else loading_execution = true;
        try {
            const result = await api.list_models(target_cli);
            if (is_planning) {
                planning_models = result;
                last_planning_cli = target_cli;
                if (!result.find((m) => m.value === planning_model) && result.length > 0) planning_model = result[0].value;
            }
            else {
                execution_models = result;
                last_execution_cli = target_cli;
                if (!result.find((m) => m.value === execution_model) && result.length > 0) execution_model = result[0].value;
            }
        }
        catch {
            toast_store.error(`Failed to load ${kind} models`);
        }
        finally {
            if (is_planning) loading_planning = false;
            else loading_execution = false;
        }
    }

    $effect(() => {
        load_models_for(cli, 'planning');
        load_models_for(execution_cli, 'execution');
    });

    function add_resource_field() {
        resources = [...resources, { url: '', title: '' }];
    }

    function remove_resource(index: number) {
        resources = resources.filter((_, i) => i !== index);
    }

    async function handle_submit() {
        if (!title.trim()) return;
        creating = true;
        form_error = null;
        try {
            const clean_resources = resources.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), title: r.title.trim() || undefined }));
            await on_create({
                title: title.trim(), description: description.trim() || undefined,
                cli, execution_cli, planning_model: planning_model || null,
                execution_model: execution_model || null, on_task_failure, task_timeout_minutes,
                resources: clean_resources
            });
            title = '';
            description = '';
            cli = 'copilot';
            execution_cli = 'copilot';
            planning_model = '';
            execution_model = '';
            on_task_failure = 'stop';
            task_timeout_minutes = 10;
            resources = [];
            form_error = null;
        }
        catch (error) {
            form_error = error instanceof Error ? error.message : 'Failed to create feature. Please try again.';
        }
        finally {
            creating = false;
        }
    }
</script>

<form
    class="create-form"
    onsubmit={(event) => {
        event.preventDefault();
        handle_submit();
    }}
>
    <!-- Stage 1: Always visible -->
    <Input type="text" placeholder="Feature title" bind:value={title} required />
    <Textarea placeholder="Description" bind:value={description} rows={4} />

    <div class="resources-section">
        <div class="resources-header">
            <span><span class="icon" style="font-size:16px">link</span> Resources</span>
            <Button type="button" variant="secondary" size="sm" onclick={add_resource_field}>
                <span class="icon" style="font-size:14px">add</span> Add URL
            </Button>
        </div>
        {#each resources as resource, index (index)}
            <div class="resource-row">
                <Input type="url" placeholder="https://..." bind:value={resource.url} class="input" />
                <div class="title-field">
                    <Input type="text" placeholder="Title" bind:value={resource.title} class="input" />
                </div>
                <Button type="button" variant="danger" size="icon" onclick={() => remove_resource(index)} aria-label="Remove resource">
                    <span class="icon" style="font-size:16px">close</span>
                </Button>
            </div>
        {/each}
    </div>

    <!-- Stage 2: Advanced Settings (collapsed by default) -->
    <button type="button" class="advanced-toggle" onclick={() => (show_advanced = !show_advanced)}>
        <span class="icon" style="font-size:16px">{show_advanced ? 'expand_less' : 'expand_more'}</span>
        Advanced Settings
    </button>

    {#if show_advanced}
        <div class="advanced-section">
            <div class="selection-grid">
                <div class="field">
                    <Select id="cli-select" label="Planning CLI" bind:value={cli} class="input select">
                        <option value="copilot">Copilot CLI</option>
                        <option value="gemini">Gemini CLI</option>
                    </Select>
                </div>
                <div class="field">
                    <Select id="planning-model-select" label={plan_lbl} bind:value={planning_model} disabled={loading_planning}>
                        {#each planning_models as m (m.value)}
                            <option value={m.value}>{m.label}{is_default_planning && m.value === planning_models[0]?.value ? ' (Recommended)' : ''}</option>
                        {/each}
                    </Select>
                    <span class="help-text">The AI model that breaks your feature into tasks</span>
                </div>
                <div class="field">
                    <Select id="execution-cli-select" label="Execution CLI" bind:value={execution_cli} class="input select">
                        <option value="copilot">Copilot CLI</option>
                        <option value="gemini">Gemini CLI</option>
                    </Select>
                </div>
                <div class="field">
                    <Select id="execution-model-select" label={exec_lbl} bind:value={execution_model} disabled={loading_execution}>
                        {#each execution_models as m (m.value)}
                            <option value={m.value}>{m.label}{is_default_execution && m.value === execution_models[0]?.value ? ' (Recommended)' : ''}</option>
                        {/each}
                    </Select>
                    <span class="help-text">The AI model that implements each task</span>
                </div>
                <div class="field">
                    <Select id="failure-select" label="On Task Failure" bind:value={on_task_failure} class="input select">
                        <option value="stop">Stop</option>
                        <option value="retry">Retry</option>
                        <option value="skip">Skip</option>
                    </Select>
                </div>
                <div class="field">
                    <Input id="timeout-input" type="number" bind:value={task_timeout_minutes} class="input" label="Task Timeout (min)" min="1" max="60" />
                </div>
            </div>
        </div>
    {/if}

    {#if form_error}
        <div class="form-error">
            <span class="icon" style="font-size:14px">error</span>
            {form_error}
        </div>
    {/if}

    <div class="form-actions">
        <Button type="button" variant="secondary" onclick={on_cancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={creating || !title.trim() || !planning_model || !execution_model}>
            <span class="icon" style="font-size:16px">save</span>
            {creating ? 'Creating...' : 'Save Draft'}
        </Button>
    </div>
</form>

<style>
    .create-form {
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 1.25rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
    }
    .resources-section { margin-top: 0.5rem; }
    .resources-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--fg-muted);
    }
    .resources-header span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .resource-row {
        display: flex; gap: 0.5rem; align-items: center;
        margin-bottom: 0.5rem; flex-wrap: wrap;
    }
    .title-field { max-width: 180px; }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .help-text { font-size: 0.7rem; color: var(--fg-muted); font-style: italic; }
    .advanced-toggle {
        display: flex; align-items: center; gap: 0.3rem;
        background: transparent; border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.5rem 0.75rem; color: var(--fg-muted); font-size: 0.85rem;
        cursor: pointer; transition: all 0.15s; width: 100%;
        font-family: var(--font);
    }
    .advanced-toggle:hover { border-color: var(--accent); color: var(--fg); }
    .advanced-section { animation: slide-down 200ms ease; }
    @keyframes slide-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .form-error {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.5rem 0.75rem; border-radius: var(--radius);
        background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444; font-size: 0.8rem;
    }
    @media (max-width: 768px) {
        .resource-row { flex-direction: column; }
        .title-field { max-width: 100%; }
        .selection-grid { grid-template-columns: 1fr; }
    }
</style>

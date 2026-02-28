<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import { api } from '$lib/api/client';
    import { Input } from '$lib/components/primitives/input';
    import { Select } from '$lib/components/primitives/select';
    import { Textarea } from '$lib/components/primitives/textarea';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { FailureBehavior } from '$lib/types';

    interface ModelOption {
        value: string;
        label: string;
    }

    interface Props {
        on_create: (data: {
            title: string;
            description?: string;
            cli: string;
            model: string | null;
            on_task_failure: FailureBehavior;
            task_timeout_minutes: number;
            resources: { url: string; title?: string }[];
        }) => Promise<void>;
        on_cancel: () => void;
    }

    let { on_create, on_cancel }: Props = $props();

    let title = $state('');
    let description = $state('');
    let cli = $state('copilot');
    let model = $state('');
    let on_task_failure = $state<FailureBehavior>('stop');
    let task_timeout_minutes = $state(10);
    let models = $state<ModelOption[]>([]);
    let resources = $state<{ url: string; title: string }[]>([]);
    let creating = $state(false);
    let loading_models = $state(false);

    let last_cli = $state('');

    async function load_models(target_cli: string) {
        if (target_cli === last_cli) return;
        loading_models = true;
        try {
            models = await api.list_models(target_cli);
            last_cli = target_cli;
            // Select the first model if current model is not in the new list
            if (!models.find((m) => m.value === model) && models.length > 0) {
                model = models[0].value;
            }
        } catch (err) {
            console.error('Failed to load models:', err);
            toast_store.error('Failed to load models');
        } finally {
            loading_models = false;
        }
    }

    $effect(() => {
        load_models(cli);
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
        try {
            const clean_resources = resources.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), title: r.title.trim() || undefined }));

            await on_create({
                title: title.trim(),
                description: description.trim() || undefined,
                cli,
                model: model || null,
                on_task_failure,
                task_timeout_minutes,
                resources: clean_resources
            });
            title = '';
            description = '';
            cli = 'copilot';
            model = '';
            on_task_failure = 'stop';
            task_timeout_minutes = 10;
            resources = [];
        } finally {
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
    <Input type="text" placeholder="Feature title" bind:value={title} required />
    <Textarea placeholder="Description" bind:value={description} rows={4} />

    <div class="selection-grid">
        <div class="field">
            <Select id="cli-select" label="CLI Engine" bind:value={cli} class="input select">
                <option value="copilot">Copilot CLI</option>
                <option value="gemini">Gemini CLI</option>
            </Select>
        </div>
        <div class="field">
            <Select id="model-select" label={`Model ${loading_models ? '(loading...)' : ''}`} bind:value={model} class="input select" disabled={loading_models}>
                {#each models as m}
                    <option value={m.value}>{m.label}</option>
                {/each}
            </Select>
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

    <div class="resources-section">
        <div class="resources-header">
            <span><span class="icon" style="font-size:16px">link</span> Resources</span>
            <Button type="button" variant="secondary" size="sm" onclick={add_resource_field}>
                <span class="icon" style="font-size:14px">add</span> Add URL
            </Button>
        </div>
        {#each resources as resource, index}
            <div class="resource-row">
                <Input type="url" placeholder="https://..." bind:value={resource.url} class="input" />
                <Input type="text" placeholder="Title" bind:value={resource.title} class="input input-title" />
                <Button type="button" variant="danger" size="icon" onclick={() => remove_resource(index)}>
                    <span class="icon" style="font-size:16px">close</span>
                </Button>
            </div>
        {/each}
    </div>
    <div class="form-actions">
        <Button type="button" variant="secondary" onclick={on_cancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={creating || !title.trim()}>
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
    :global(.input-title) {
        max-width: 180px;
    }
    .resources-section {
        margin-top: 0.5rem;
    }
    .resources-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: var(--fg-muted);
    }
    .resources-header span {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
    }
    .resource-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
    }
    .form-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }
    @media (max-width: 768px) {
        .resource-row {
            flex-direction: column;
        }
        :global(.input-title) {
            max-width: 100%;
        }
        .selection-grid {
            grid-template-columns: 1fr;
        }
    }
    .selection-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    :global(.field-label) {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--fg-muted);
    }
</style>

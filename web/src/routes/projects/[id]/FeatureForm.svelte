<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import { Input } from '$lib/components/primitives/input';
    import { Textarea } from '$lib/components/primitives/textarea';
    import type { FailureBehavior } from '$lib/types';
    import type { CreateFeatureData } from './feature_actions';
    import FeatureAdvancedSettings from './FeatureAdvancedSettings.svelte';

    interface Props {
        on_create: (data: CreateFeatureData) => Promise<void>
        on_cancel: () => void
    }

    let { on_create, on_cancel }: Props = $props();

    let title = $state('');
    let description = $state('');
    let planning_model = $state('');
    let execution_model = $state('');
    let on_task_failure = $state<FailureBehavior>('stop');
    let task_timeout_minutes = $state(10);
    let resources = $state<{ url: string, title: string }[]>([]);
    let creating = $state(false);
    let form_error = $state<string | null>(null);

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
                planning_model: planning_model || null,
                execution_model: execution_model || null, on_task_failure, task_timeout_minutes,
                resources: clean_resources
            });
            title = '';
            description = '';
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

    <FeatureAdvancedSettings
        bind:planning_model
        bind:execution_model
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
    .form-error {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.5rem 0.75rem; border-radius: var(--radius);
        background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444; font-size: 0.8rem;
    }
    @media (max-width: 768px) {
        .resource-row { flex-direction: column; }
        .title-field { max-width: 100%; }
    }
</style>

<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import { Input } from '$lib/components/primitives/input';

    interface Props {
        resources: { url: string, title: string }[]
    }

    let { resources = $bindable() }: Props = $props();

    function add_field() {
        resources = [...resources, { url: '', title: '' }];
    }

    function remove_field(index: number) {
        resources = resources.filter((_, i) => i !== index);
    }
</script>

<div class="resources-section">
    <div class="resources-header">
        <span><span class="icon" style="font-size:16px">link</span> Resources</span>
        <Button type="button" variant="secondary" size="sm" onclick={add_field}>
            <span class="icon" style="font-size:14px">add</span> Add URL
        </Button>
    </div>
    {#each resources as resource, index (index)}
        <div class="resource-row">
            <Input type="url" placeholder="https://..." bind:value={resource.url} class="input" aria-label="Resource URL" />
            <div class="title-field">
                <Input type="text" placeholder="Title" bind:value={resource.title} class="input" aria-label="Resource title" />
            </div>
            <Button
                type="button"
                variant="danger"
                size="icon"
                onclick={() => remove_field(index)}
                aria-label="Remove resource"
            >
                <span class="icon" style="font-size:16px">close</span>
            </Button>
        </div>
    {/each}
</div>

<style>
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
    .title-field {
        max-width: 180px;
    }
    @media (max-width: 768px) {
        .resource-row { flex-direction: column; }
        .title-field { max-width: 100%; }
    }
</style>

<script lang="ts">
    import { Button, Input } from '$lib/components/primitives';
    import { status_icon, status_class } from '$lib/utils/status';
    import type { Feature } from '$lib/types';

    interface Props {
        feature: Feature
        on_add_resource: (url: string, title?: string) => Promise<void>
        on_remove_resource: (resource_id: string) => Promise<void>
    }

    let { feature, on_add_resource, on_remove_resource }: Props = $props();

    let new_resource_url = $state('');
    let new_resource_title = $state('');

    async function add_resource() {
        if (!new_resource_url.trim()) return;
        await on_add_resource(new_resource_url.trim(), new_resource_title.trim() || undefined);
        new_resource_url = '';
        new_resource_title = '';
    }
</script>

{#if feature.resources && feature.resources.length > 0}
    <div class="detail-section">
        <h4><span class="icon" style="font-size:16px">link</span> Resources</h4>
        <ul class="resource-list">
            {#each feature.resources as resource (resource.id)}
                <li>
                    <a href={resource.url} target="_blank" rel="external noopener">
                        <span class="icon" style="font-size:14px">open_in_new</span>
                        {resource.title ?? resource.url}
                    </a>
                    <div class="resource-actions">
                        <span class="badge badge-{status_class(resource.status)}">
                            <span class="icon" style="font-size:11px">
                                {status_icon(resource.status)}
                            </span>
                            {resource.status}
                        </span>
                        {#if feature.status === 'Draft'}
                            <Button
                                variant="danger"
                                size="icon"
                                onclick={() => on_remove_resource(resource.id)}
                                title="Remove resource"
                                aria-label="Remove resource"
                            >
                                <span class="icon" style="font-size:14px">close</span>
                            </Button>
                        {/if}
                    </div>
                </li>
            {/each}
        </ul>
    </div>
{/if}

{#if feature.status === 'Draft'}
    <div class="detail-section">
        <h4><span class="icon" style="font-size:16px">add_link</span> Add Resource</h4>
        <div class="add-resource-row">
            <Input type="url" placeholder="https://..." bind:value={new_resource_url} />
            <Input type="text" placeholder="Title" bind:value={new_resource_title} class="input-title" />
            <Button variant="primary" size="sm" onclick={add_resource} disabled={!new_resource_url.trim()}>
                <span class="icon" style="font-size:14px">add</span> Add
            </Button>
        </div>
    </div>
{/if}

<style>
    .detail-section { margin-bottom: 1.25rem; }
    .detail-section h4 {
        font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem;
        display: flex; align-items: center; gap: 0.3rem;
    }
    .resource-list { list-style: none; }
    .resource-list li {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.4rem 0; border-bottom: 1px solid var(--border);
        flex-wrap: wrap; gap: 0.5rem;
    }
    .resource-list a {
        color: var(--accent); text-decoration: none; font-size: 0.85rem;
        display: inline-flex; align-items: center; gap: 0.3rem;
    }
    .resource-actions { display: flex; align-items: center; gap: 0.35rem; }
    .add-resource-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    :global(.input-title) { max-width: 180px; }
    @media (max-width: 768px) {
        :global(.input-title) { max-width: 100%; }
    }
</style>

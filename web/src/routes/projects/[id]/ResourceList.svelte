<script lang="ts">
    import { Button, Input } from '$lib/components/primitives';
    import type { Feature } from '$lib/types';

    interface Props {
        feature: Feature
        on_add_resource: (url: string, title?: string) => Promise<void>
        on_remove_resource: (resource_id: string) => Promise<void>
    }

    let { feature, on_add_resource, on_remove_resource }: Props = $props();

    let new_resource_url = $state('');
    let new_resource_title = $state('');

    const is_draft = $derived(feature.status === 'draft');

    function get_status_display(status: string): { label: string, icon: string, class_name: string } {
        const s = status.toLowerCase();
        if (s === 'pending') return { label: 'Fetching…', icon: 'progress_activity', class_name: 'badge-pending' };
        if (s === 'fetched') return { label: 'Ready', icon: 'check_circle', class_name: 'badge-ready' };
        if (s === 'error') return { label: 'Failed to fetch', icon: 'cancel', class_name: 'badge-error' };
        return { label: status, icon: 'help', class_name: 'badge-muted' };
    }

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
                {@const status_display = get_status_display(resource.status)}
                <li>
                    <a href={resource.url} target="_blank" rel="external noopener">
                        <span class="icon" style="font-size:14px">open_in_new</span>
                        {resource.title ?? resource.url}
                    </a>
                    <div class="resource-actions">
                        <span class="badge {status_display.class_name}">
                            <span class="icon {status_display.class_name === 'badge-pending' ? 'spin' : ''}" style="font-size:11px">
                                {status_display.icon}
                            </span>
                            {status_display.label}
                        </span>
                        {#if is_draft}
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

<div class="detail-section">
    <h4><span class="icon" style="font-size:16px">add_link</span> Add Resource</h4>
    {#if !is_draft}
        <p class="resource-note">This resource will be available for future tasks.</p>
    {/if}
    <div class="add-resource-row">
        <Input type="url" placeholder="https://..." bind:value={new_resource_url} />
        <Input type="text" placeholder="Title" bind:value={new_resource_title} class="input-title" />
        <Button variant="primary" size="sm" onclick={add_resource} disabled={!new_resource_url.trim()}>
            <span class="icon" style="font-size:14px">add</span> Add
        </Button>
    </div>
</div>

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
    .badge {
        display: inline-flex; align-items: center; gap: 0.2rem;
        padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 500;
    }
    .badge-pending { background: rgba(107, 114, 128, 0.15); color: var(--fg-muted); }
    .badge-ready { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
    .badge-error { background: rgba(var(--danger-rgb), 0.1); color: var(--danger); }
    .badge-muted { background: rgba(107, 114, 128, 0.15); color: var(--fg-muted); }
    .resource-note {
        font-size: 0.75rem; color: var(--fg-muted); font-style: italic;
        margin-bottom: 0.5rem;
    }
    .add-resource-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    :global(.input-title) { max-width: 180px; }
    @media (max-width: 768px) {
        :global(.input-title) { max-width: 100%; }
    }
</style>

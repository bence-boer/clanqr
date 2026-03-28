<script lang="ts">
    import { Button, Badge } from '$lib/components/primitives';
    import { EmptyState, Checkbox } from '$lib/components';
    import type { Feature, TaskRow } from '$lib/types';
    import { status_icon, status_class } from '$lib/utils/status';
    import { SvelteSet } from 'svelte/reactivity';

    interface Props {
        features: Feature[]
        selected_feature: Feature | null
        on_select: (feature: Feature) => void
        on_delete_selected: (ids: Set<string>) => Promise<void>
    }

    let { features, selected_feature, on_select, on_delete_selected }: Props = $props();

    let selected_ids = $state<Set<string>>(new Set());
    let deleting = $state(false);
    let all_selected = $derived(features.length > 0 && selected_ids.size === features.length);

    function toggle_select(id: string, event: MouseEvent) {
        event.stopPropagation();
        const next = new SvelteSet(selected_ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selected_ids = next;
    }

    function toggle_all() {
        if (all_selected) {
            selected_ids = new Set();
        }
        else {
            selected_ids = new Set(features.map((f) => f.id));
        }
    }

    async function delete_selected() {
        if (selected_ids.size === 0) return;
        if (!confirm(`Delete ${selected_ids.size} feature(s)?`)) return;
        deleting = true;
        try {
            await on_delete_selected(selected_ids);
            selected_ids = new Set();
        }
        finally {
            deleting = false;
        }
    }

    function get_pending_approval_count(feature: Feature): number {
        return feature.tasks?.filter((t: TaskRow) => t.status === 'queued').length ?? 0;
    }
</script>

<section class="features-panel" aria-label="Features">
    <div class="features-panel-header">
        <h3><span class="icon" style="font-size:18px">category</span> Features ({features.length})</h3>
        <div class="features-panel-actions">
            {#if features.length > 0}
                <label class="select-all-label">
                    <Checkbox checked={all_selected} onchange={toggle_all} />
                    All
                </label>
            {/if}
            {#if selected_ids.size > 0}
                <Button variant="danger" size="sm" onclick={delete_selected} disabled={deleting}>
                    <span class="icon" style="font-size:14px">delete</span>
                    {selected_ids.size}
                </Button>
            {/if}
        </div>
    </div>
    {#if features.length === 0}
        <EmptyState icon="category" message="No features yet." />
    {:else}
        {#each features as feature (feature.id)}
            {@const pending_count = get_pending_approval_count(feature)}
            <button class="feature-item" class:selected={selected_feature?.id === feature.id} onclick={() => on_select(feature)}>
                <div class="feature-item-header">
                    <div class="feature-name-row">
                        <Checkbox checked={selected_ids.has(feature.id)} onclick={(e: MouseEvent) => toggle_select(feature.id, e)} />
                        <span class="feature-name">{feature.title}</span>
                        {#if pending_count > 0}
                            <span class="approval-badge" title="{pending_count} task{pending_count > 1 ? 's' : ''} pending approval">{pending_count}</span>
                        {/if}
                    </div>
                    <Badge variant={status_class(feature.status)}>
                        <span class="icon" style="font-size:12px">{status_icon(feature.status)}</span>
                        {feature.status.replace('_', ' ')}
                    </Badge>
                </div>
                <div class="feature-item-meta">
                    <span class="icon" style="font-size:12px">task</span>
                    {feature.tasks?.length ?? 0}
                    <span class="icon" style="font-size:12px;margin-left:0.5rem">link</span>
                    {feature.resources?.length ?? 0}
                </div>
            </button>
        {/each}
    {/if}
</section>

<style>
    .features-panel {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem;
    }
    .features-panel h3 {
        font-size: 0.95rem;
        color: var(--fg);
        margin-bottom: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .features-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .features-panel-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .select-all-label {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: var(--fg-muted);
        cursor: pointer;
    }
    .feature-name-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .approval-badge {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 4px;
        border-radius: 999px; font-size: 0.65rem; font-weight: 700;
        background: var(--warning, #e89a2e); color: var(--bg, #000);
    }
    .feature-item {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        cursor: pointer;
        color: inherit;
        transition: all 0.15s;
        font-family: var(--font);
        font-size: inherit;
    }
    .feature-item:hover {
        border-color: var(--accent);
    }
    .feature-item.selected {
        border-color: var(--accent);
        background: var(--bg);
    }
    .feature-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .feature-name {
        font-weight: 600;
        color: var(--fg);
        font-size: 0.875rem;
    }
    .feature-item-meta {
        font-size: 0.7rem;
        color: var(--fg-muted);
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
    }
</style>

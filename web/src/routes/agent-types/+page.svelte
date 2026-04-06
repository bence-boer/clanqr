<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, LoadingSpinner } from '$lib/components';
    import { AgentTypeBadge } from '$lib/components/agent-type-badge';
    import { Button, Input } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { onMount } from 'svelte';

    let agent_types = $state<Record<string, unknown>[]>([]);
    let loading = $state(true);
    let syncing = $state(false);
    let search = $state('');
    let selected = $state<Record<string, unknown> | null>(null);

    const filtered = $derived.by(() => {
        if (!search.trim()) return agent_types;
        const q = search.trim().toLowerCase();
        return agent_types.filter((at) =>
            String(at.name ?? '').toLowerCase().includes(q)
            || String(at.description ?? '').toLowerCase().includes(q)
        );
    });

    async function load() {
        try {
            agent_types = (await api.list_agent_types()) as Record<string, unknown>[];
        }
        catch (err) {
            console.error('Failed to load agent types:', err);
            toast_store.error('Failed to load agent types');
        }
        finally {
            loading = false;
        }
    }

    async function sync() {
        syncing = true;
        try {
            await api.sync_agent_types();
            await load();
            toast_store.success('Agent types synced from filesystem');
        }
        catch {
            toast_store.error('Failed to sync agent types');
        }
        finally {
            syncing = false;
        }
    }

    onMount(() => {
        load();
    });
</script>

<div class="page">
    <div class="page-header">
        <h2><span class="icon">smart_toy</span> Agent Types</h2>
        <Button variant="secondary" onclick={sync} disabled={syncing}>
            <span class="icon" class:spin={syncing}>{syncing ? 'progress_activity' : 'sync'}</span>
            {syncing ? 'Syncing…' : 'Sync from Filesystem'}
        </Button>
    </div>

    <div class="search-bar">
        <Input placeholder="Search agent types…" bind:value={search} aria-label="Search agent types" />
    </div>

    {#if loading}
        <LoadingSpinner label="Loading agent types…" />
    {:else if filtered.length === 0}
        <EmptyState icon="smart_toy" message="No agent types found." detail={search ? 'Try a different search.' : 'Sync from filesystem to load agent type definitions.'} />
    {:else}
        <div class="types-grid">
            {#each filtered as at (at.name)}
                <button class="type-card" class:selected={selected?.name === at.name} aria-pressed={selected?.name === at.name} onclick={() => {
                    selected = selected?.name === at.name ? null : at;
                }}>
                    <div class="card-header">
                        <AgentTypeBadge agent_type={String(at.name ?? 'custom')} />
                        {#if Array.isArray(at.tools)}<span class="tool-count">{at.tools.length} tools</span>{/if}
                    </div>
                    <h3 class="card-name">{String(at.name ?? 'Unknown')}</h3>
                    <p class="card-desc">{String(at.description ?? 'No description')}</p>
                </button>
            {/each}
        </div>
    {/if}

    {#if selected}
        <div class="expanded-detail">
            <div class="detail-header">
                <AgentTypeBadge agent_type={String(selected.name ?? 'custom')} size="md" />
                <h3>{String(selected.name ?? 'Unknown')}</h3>
                <Button variant="ghost" size="sm" onclick={() => {
                    selected = null;
                }}>
                    <span class="icon" style="font-size:16px">close</span>
                </Button>
            </div>
            <p class="detail-desc">{String(selected.description ?? 'No description available.')}</p>
            {#if Array.isArray(selected.tools) && selected.tools.length > 0}
                <div class="detail-section">
                    <h4>Tools ({selected.tools.length})</h4>
                    <div class="tool-list">
                        {#each selected.tools as tool, i (i)}<span class="tool-tag">{String(tool)}</span>{/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem; }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); display: flex; align-items: center; gap: 0.5rem; }
    .search-bar { margin-bottom: 1.25rem; max-width: 400px; }
    .types-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .type-card {
        text-align: left; background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 1rem; cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s; font-family: var(--font); width: 100%;
    }
    .type-card:hover { border-color: var(--accent); }
    .type-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.15); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .tool-count { font-size: 0.7rem; color: var(--fg-muted); }
    .card-name { font-size: 0.95rem; font-weight: 600; color: var(--fg); margin-bottom: 0.3rem; text-transform: capitalize; }
    .card-desc {
        font-size: 0.8rem; color: var(--fg-muted); line-height: 1.4;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .expanded-detail { margin-top: 1.5rem; background: var(--bg-surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 1.25rem; }
    .detail-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .detail-header h3 { flex: 1; font-size: 1.1rem; color: var(--fg); text-transform: capitalize; }
    .detail-desc { font-size: 0.875rem; color: var(--fg); line-height: 1.6; margin-bottom: 1rem; }
    .detail-section h4 { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem; }
    .tool-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .tool-tag {
        font-size: 0.75rem; background: var(--bg); border: 1px solid var(--border);
        border-radius: 4px; padding: 0.2rem 0.5rem; color: var(--fg); font-family: var(--font-mono);
    }
    @media (max-width: 768px) { .types-grid { grid-template-columns: 1fr; } }
</style>

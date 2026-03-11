<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, ErrorBanner } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import type { Trait, TraitAssignment } from '$lib/types';
    import TraitForm from './TraitForm.svelte';

    interface TraitFormData {
        name: string
        description: string
        target: 'manager' | 'ralph'
        is_global: boolean
        content: string
    }

    interface Props {
        traits: Trait[]
        on_updated: () => void
    }

    let { traits, on_updated }: Props = $props();

    let trait_filter = $state<'all' | 'manager' | 'ralph'>('all');
    let category_search = $state('');

    let filtered_traits = $derived.by(() => {
        let result = trait_filter === 'all' ? traits : traits.filter((trait) => trait.target === trait_filter);
        if (category_search.trim()) {
            const query = category_search.trim().toLowerCase();
            result = result.filter((trait) =>
                trait.name.toLowerCase().includes(query) ||
                (trait.description ?? '').toLowerCase().includes(query)
            );
        }
        return result;
    });

    // ── Trait assignment counts ──────────────────────────────────────────────
    let assignments = $state<TraitAssignment[]>([]);
    let assignment_counts = $derived.by(() => {
        const counts: Record<string, number> = {};
        for (const a of assignments) {
            counts[a.trait_id] = (counts[a.trait_id] ?? 0) + 1;
        }
        return counts;
    });

    async function load_assignments() {
        try {
            assignments = await api.list_trait_assignments({});
        } catch {
            // non-critical — counts just won't display
        }
    }

    import { onMount } from 'svelte';
    onMount(() => { load_assignments(); });

    const default_trait_form = (): TraitFormData => ({
        name: '', description: '', target: 'ralph', is_global: false, content: ''
    });

    let show_form = $state(false);
    let editing_id = $state<string | null>(null);
    let form = $state<TraitFormData>(default_trait_form());
    let form_saving = $state(false);
    let form_error = $state('');
    let delete_confirm_id = $state<string | null>(null);
    let deleting_id = $state<string | null>(null);
    let list_error = $state('');

    export function open_new_form() {
        editing_id = null;
        form = default_trait_form();
        form_error = '';
        show_form = true;
    }

    function open_edit_form(trait: Trait) {
        editing_id = trait.id;
        form = { name: trait.name, description: trait.description ?? '', target: trait.target, is_global: trait.is_global, content: trait.content };
        form_error = '';
        show_form = true;
    }

    function close_form() {
        show_form = false;
        editing_id = null;
        form = default_trait_form();
        form_error = '';
    }

    async function save_trait() {
        if (!form.name.trim()) {
            form_error = 'Name is required';
            return;
        }
        if (!form.content.trim()) {
            form_error = 'Content is required';
            return;
        }
        form_saving = true;
        form_error = '';
        try {
            const data = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                target: form.target,
                is_global: form.is_global,
                content: form.content
            };
            if (editing_id) {
                await api.update_trait(editing_id, data);
            }
            else {
                await api.create_trait(data as Parameters<typeof api.create_trait>[0]);
            }
            close_form();
            on_updated();
        }
        catch (err: unknown) {
            form_error = err instanceof Error ? err.message : String(err);
        }
        finally {
            form_saving = false;
        }
    }

    async function delete_trait(id: string) {
        deleting_id = id;
        try {
            await api.delete_trait(id);
            delete_confirm_id = null;
            on_updated();
        }
        catch (err: unknown) {
            list_error = err instanceof Error ? err.message : String(err);
        }
        finally {
            deleting_id = null;
        }
    }

    function truncate(text: string | null, max_len = 80): string {
        if (!text) return '';
        return text.length > max_len ? text.slice(0, max_len) + '…' : text;
    }
</script>

<div class="filter-bar">
    <div class="filter-row">
        {#each ['all', 'manager', 'ralph'] as const as filter_val (filter_val)}
            <Button variant="filter" active={trait_filter === filter_val} onclick={() => {
                trait_filter = filter_val;
            }}>
                {filter_val === 'all' ? 'All' : filter_val === 'manager' ? 'Manager' : 'Ralph'}
            </Button>
        {/each}
        <span class="filter-count">{filtered_traits.length} trait{filtered_traits.length !== 1 ? 's' : ''}</span>
    </div>
    <input
        type="text"
        class="category-search"
        placeholder="Filter by name or description…"
        bind:value={category_search}
    />
</div>

{#if show_form}
    <TraitForm bind:form {editing_id} {form_saving} {form_error} on_save={save_trait} on_close={close_form} />
{/if}

{#if list_error}
    <ErrorBanner message={list_error} />
{/if}

{#if filtered_traits.length === 0}
    <EmptyState icon="psychology" message={trait_filter === 'all' ? 'No traits yet.' : `No ${trait_filter} traits.`} detail="Create a trait to extend agent behaviour on specific tasks." />
{:else}
    <div class="traits-list">
        {#each filtered_traits as trait (trait.id)}
            <div class="trait-row">
                <div class="trait-main">
                    <div class="trait-header-row">
                        <span class="trait-name">{trait.name}</span>
                        <div class="trait-badges">
                            <Badge variant={trait.target === 'manager' ? 'info' : trait.target === 'ralph' ? 'warning' : 'default'}>{trait.target}</Badge>
                            {#if trait.is_global}<Badge variant="success">global</Badge>{/if}
                            {#if (assignment_counts[trait.id] ?? 0) > 0}
                                <Badge variant="muted">Used in {assignment_counts[trait.id]} task{assignment_counts[trait.id] !== 1 ? 's' : ''}</Badge>
                            {/if}
                        </div>
                    </div>
                    {#if trait.description}<p class="trait-desc">{truncate(trait.description)}</p>{/if}
                    <p class="trait-preview">{truncate(trait.content, 120)}</p>
                </div>
                <div class="trait-actions">
                    {#if delete_confirm_id === trait.id}
                        <span class="confirm-text">Delete?</span>
                        <Button variant="danger" size="sm" onclick={() => delete_trait(trait.id)} disabled={deleting_id === trait.id}>
                            {deleting_id === trait.id ? '…' : 'Yes'}
                        </Button>
                        <Button variant="secondary" size="sm" onclick={() => {
                            delete_confirm_id = null;
                        }}>No</Button>
                    {:else}
                        <Button variant="secondary" size="sm" icon="edit" onclick={() => open_edit_form(trait)}>Edit</Button>
                        <Button variant="danger" size="sm" icon="delete" onclick={() => {
                            delete_confirm_id = trait.id;
                        }} aria-label="Delete {trait.name}" />
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .filter-bar { display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem; }
    .filter-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .filter-count { margin-left: auto; font-size: 0.8rem; color: var(--fg-muted); }
    .category-search {
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        font-size: 0.85rem;
        outline: none;
        transition: border-color 0.15s;
    }
    .category-search:focus { border-color: var(--accent); }
    .category-search::placeholder { color: var(--fg-muted); }
    .traits-list { overflow-x: hidden; display: flex; flex-direction: column; gap: 0.5rem; }
    .trait-row {
        display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.85rem 1.1rem; transition: border-color 0.15s; flex-wrap: wrap;
        max-width: 100%; overflow: hidden; box-sizing: border-box;
    }
    .trait-row:hover { border-color: var(--bg-elevated); }
    .trait-main { flex: 1; min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 0.2rem; }
    .trait-header-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .trait-name { font-weight: 600; color: var(--fg); font-size: 0.875rem; font-family: 'SF Mono', 'Fira Code', monospace; }
    .trait-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .trait-desc { font-size: 0.82rem; color: var(--fg-muted); }
    .trait-preview {
        font-size: 0.75rem; color: var(--fg-muted); opacity: 0.55;
        font-family: 'SF Mono', 'Fira Code', monospace;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .trait-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
    .confirm-text { font-size: 0.8rem; color: var(--danger); font-weight: 600; white-space: nowrap; }
    @media (max-width: 768px) {
        .filter-row { flex-direction: column; align-items: stretch; }
        .filter-count { margin-left: 0; width: 100%; }
        .trait-row { flex-direction: column; align-items: flex-start; }
        .trait-actions { align-self: flex-end; flex-wrap: wrap; }
    }
</style>

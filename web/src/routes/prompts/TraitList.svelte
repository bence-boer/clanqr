<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, ErrorBanner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import type { Trait, TraitAssignment, TraitTarget } from '$lib/types';
    import TraitForm from './TraitForm.svelte';
    import TraitRow from './TraitRow.svelte';

    interface TraitFormData {
        name: string
        description: string
        target: TraitTarget
        is_global: boolean
        content: string
    }

    interface Props {
        traits: Trait[]
        on_updated: () => void
    }

    let { traits, on_updated }: Props = $props();

    let trait_filter = $state<'all' | TraitTarget>('all');
    let category_search = $state('');

    let filtered_traits = $derived.by(() => {
        let result = trait_filter === 'all' ? traits : traits.filter((trait) => trait.target === trait_filter);
        if (category_search.trim()) {
            const query = category_search.trim().toLowerCase();
            result = result.filter((trait) =>
                trait.name.toLowerCase().includes(query)
                || (trait.description ?? '').toLowerCase().includes(query)
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
        }
        catch {
            // non-critical — counts just won't display
        }
    }

    import { onMount } from 'svelte';
    onMount(() => {
        load_assignments();
    });

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
</script>

<div class="filter-bar">
    <div class="filter-row" role="group" aria-label="Filter traits">
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
        aria-label="Filter traits"
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
            <TraitRow
                {trait}
                assignment_count={assignment_counts[trait.id] ?? 0}
                delete_confirming={delete_confirm_id === trait.id}
                deleting={deleting_id === trait.id}
                on_edit={() => open_edit_form(trait)}
                on_confirm_delete={() => delete_trait(trait.id)}
                on_request_delete={() => {
                    delete_confirm_id = trait.id;
                }}
                on_cancel_delete={() => {
                    delete_confirm_id = null;
                }}
            />
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
    @media (max-width: 768px) {
        .filter-row { flex-direction: column; align-items: stretch; }
        .filter-count { margin-left: 0; width: 100%; }
    }
</style>

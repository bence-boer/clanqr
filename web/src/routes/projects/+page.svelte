<script lang="ts">
    import { ConfirmModal, EmptyState, LoadingSpinner, Checkbox } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import type { Feature, Project, ProjectStatus } from '$lib/types';
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import ProjectCard from './ProjectCard.svelte';
    import ProjectCreateForm from './ProjectCreateForm.svelte';
    import ProjectSearchBar from './ProjectSearchBar.svelte';
    import {
        load_projects_data,
        create_project_action,
        delete_project_action,
        delete_projects_action,
        archive_project_action,
        unarchive_project_action,
        save_project_edit_action
    } from './projects-actions';

    type FilterStatus = 'All' | ProjectStatus;

    let projects = $state<Project[]>([]);
    let features_by_project = $state<Record<string, Feature[]>>({});
    let loading = $state(true);
    let show_create = $state(false);
    let new_name = $state('');
    let new_description = $state('');
    let creating = $state(false);
    let selected_ids = $state<Set<string>>(new Set());
    let deleting_selected = $state(false);
    let search_query = $state('');
    let active_filter = $state<FilterStatus>('All');
    let confirm_delete_id = $state<string | null>(null);
    let confirm_bulk_delete = $state(false);

    const filtered_projects = $derived.by(() => {
        let result = projects;
        if (active_filter !== 'All') result = result.filter((p) => p.status === active_filter);
        if (search_query.trim()) {
            const q = search_query.toLowerCase();
            result = result.filter(
                (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
            );
        }
        return result;
    });

    let all_selected = $derived(filtered_projects.length > 0 && selected_ids.size === filtered_projects.length);

    function toggle_select(id: string) {
        const next = new SvelteSet(selected_ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selected_ids = next;
    }

    function toggle_all() {
        selected_ids = all_selected ? new Set() : new Set(filtered_projects.map((p) => p.id));
    }

    async function refresh() {
        const data = await load_projects_data();
        if (data) {
            projects = data.projects;
            features_by_project = data.features_by_project;
        }
        loading = false;
    }

    async function handle_create() {
        if (!new_name.trim()) return;
        creating = true;
        try {
            if (await create_project_action(new_name, new_description)) {
                new_name = '';
                new_description = '';
                show_create = false;
                await refresh();
            }
        }
        finally {
            creating = false;
        }
    }

    async function handle_delete_selected() {
        deleting_selected = true;
        confirm_bulk_delete = false;
        try {
            if (await delete_projects_action([...selected_ids])) {
                selected_ids = new Set();
                await refresh();
            }
        }
        finally {
            deleting_selected = false;
        }
    }

    async function handle_confirm_delete() {
        if (!confirm_delete_id) return;
        const id = confirm_delete_id;
        confirm_delete_id = null;
        if (await delete_project_action(id)) await refresh();
    }

    async function handle_archive(id: string) {
        if (await archive_project_action(id)) await refresh();
    }

    async function handle_unarchive(id: string) {
        if (await unarchive_project_action(id)) await refresh();
    }

    async function handle_save(id: string, name: string, description: string): Promise<boolean> {
        const ok = await save_project_edit_action(id, name, description);
        if (ok) await refresh();
        return ok;
    }

    onMount(() => {
        refresh();
    });
</script>

<div class="page">
    <div class="page-header">
        <h2>Projects</h2>
        <div class="header-actions">
            {#if projects.length > 0}
                <label class="select-all-label">
                    <Checkbox checked={all_selected} onchange={toggle_all} /> Select all
                </label>
            {/if}
            {#if selected_ids.size > 0}
                <Button variant="danger" icon="delete" onclick={() => (confirm_bulk_delete = true)} disabled={deleting_selected}>
                    Delete {selected_ids.size}
                </Button>
            {/if}
            <Button variant="primary" icon={show_create ? 'close' : 'add'} onclick={() => (show_create = !show_create)}>
                {show_create ? 'Cancel' : 'New Project'}
            </Button>
        </div>
    </div>

    <ProjectCreateForm show={show_create} bind:new_name bind:new_description {creating} on_create={handle_create} />

    {#if !loading && projects.length > 0}
        <ProjectSearchBar
            bind:search_query
            bind:active_filter
            filtered_count={filtered_projects.length}
            total_count={projects.length}
        />
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading projects..." />
    {:else if projects.length === 0}
        <EmptyState icon="folder" message="No projects yet" detail="Create one to get started." />
    {:else if filtered_projects.length === 0}
        <EmptyState icon="search_off" message="No matching projects" detail="Try a different search or filter." />
    {:else}
        <div class="project-grid">
            {#each filtered_projects as project (project.id)}
                <ProjectCard
                    {project}
                    features={features_by_project[project.id] ?? []}
                    selected={selected_ids.has(project.id)}
                    on_save={handle_save}
                    on_delete={(id) => (confirm_delete_id = id)}
                    on_archive={handle_archive}
                    on_unarchive={handle_unarchive}
                    on_toggle_select={toggle_select}
                />
            {/each}
        </div>
    {/if}
</div>

<ConfirmModal
    title="Delete Project"
    message="Delete this project and all its features? This cannot be undone."
    confirm_label="Delete"
    variant="danger"
    open={confirm_delete_id !== null}
    on_confirm={handle_confirm_delete}
    on_cancel={() => (confirm_delete_id = null)}
/>

<ConfirmModal
    title="Delete Projects"
    message={`Delete ${selected_ids.size} project(s) and all their features? This cannot be undone.`}
    confirm_label="Delete All"
    variant="danger"
    open={confirm_bulk_delete}
    on_confirm={handle_delete_selected}
    on_cancel={() => (confirm_bulk_delete = false)}
/>

<style>
    .page { max-width: 900px; }
    .page-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
    }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .select-all-label {
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.8rem; color: var(--fg-muted); cursor: pointer;
    }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); }
    .project-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;
    }
    @media (max-width: 768px) {
        .project-grid { grid-template-columns: 1fr; }
    }
</style>

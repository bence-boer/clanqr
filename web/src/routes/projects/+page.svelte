<script lang="ts">
    import { api } from '$lib/api/client';
    import { ConfirmModal, EmptyState, LoadingSpinner } from '$lib/components';
    import { Button, Input } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, Project, ProjectStatus } from '$lib/types';
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import ProjectCard from './ProjectCard.svelte';
    import ProjectCreateForm from './ProjectCreateForm.svelte';

    type FilterStatus = 'All' | ProjectStatus;

    let projects = $state<Project[]>([]);
    let features_by_project = $state<Record<string, Feature[]>>({});
    let loading = $state(true);
    let show_create = $state(false);
    let new_name = $state('');
    let new_description = $state('');
    let creating = $state(false);
    let editing_id = $state<string | null>(null);
    let edit_name = $state('');
    let edit_description = $state('');
    let saving_edit = $state(false);
    let selected_ids = $state<Set<string>>(new Set());
    let deleting_selected = $state(false);
    let search_query = $state('');
    let active_filter = $state<FilterStatus>('All');

    // Confirm modal state for destructive actions
    let confirm_delete_id = $state<string | null>(null);
    let confirm_bulk_delete = $state(false);

    const filtered_projects = $derived.by(() => {
        let result = projects;
        if (active_filter !== 'All') {
            result = result.filter((p) => p.status === active_filter);
        }
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

    async function load_projects() {
        try {
            const [proj, feats] = await Promise.all([
                api.list_projects(),
                api.list_features()
            ]);
            projects = proj;
            const grouped: Record<string, Feature[]> = {};
            for (const feat of feats) {
                const pid = feat.project_id;
                if (!grouped[pid]) grouped[pid] = [];
                grouped[pid].push(feat);
            }
            features_by_project = grouped;
        }
        catch (error) {
            console.error('Failed to load projects:', error);
            toast_store.error('Failed to load projects');
        }
        finally {
            loading = false;
        }
    }

    async function create_project() {
        if (!new_name.trim()) return;
        creating = true;
        try {
            await api.create_project({ name: new_name.trim(), description: new_description.trim() || undefined });
            new_name = '';
            new_description = '';
            show_create = false;
            await load_projects();
        }
        catch (error) {
            console.error('Failed to create project:', error);
            toast_store.error('Failed to create project');
        }
        finally {
            creating = false;
        }
    }

    async function confirm_delete_selected() {
        if (selected_ids.size === 0) return;
        confirm_bulk_delete = true;
    }

    async function delete_selected() {
        deleting_selected = true;
        confirm_bulk_delete = false;
        try {
            await Promise.all([...selected_ids].map((id) => api.delete_project(id)));
            selected_ids = new Set();
            await load_projects();
        }
        catch (error) {
            console.error('Failed to delete projects:', error);
            toast_store.error('Failed to delete projects');
        }
        finally {
            deleting_selected = false;
        }
    }

    async function delete_project(id: string) {
        confirm_delete_id = id;
    }

    async function handle_confirm_delete() {
        if (!confirm_delete_id) return;
        const id = confirm_delete_id;
        confirm_delete_id = null;
        try {
            await api.delete_project(id);
            await load_projects();
        }
        catch (error) {
            console.error('Failed to delete project:', error);
            toast_store.error('Failed to delete project');
        }
    }

    async function archive_project(id: string) {
        try {
            await api.update_project(id, { status: 'Archived' } as Record<string, unknown> as { name?: string, description?: string | null });
            toast_store.success('Project archived');
            await load_projects();
        }
        catch (error) {
            console.error('Failed to archive project:', error);
            toast_store.error('Failed to archive project');
        }
    }

    async function unarchive_project(id: string) {
        try {
            await api.update_project(id, { status: 'Active' } as Record<string, unknown> as { name?: string, description?: string | null });
            toast_store.success('Project restored');
            await load_projects();
        }
        catch (error) {
            console.error('Failed to restore project:', error);
            toast_store.error('Failed to restore project');
        }
    }

    function start_edit(project: Project, event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        editing_id = project.id;
        edit_name = project.name;
        edit_description = project.description ?? '';
    }

    function cancel_edit(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        editing_id = null;
    }

    async function save_edit(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (!editing_id || !edit_name.trim()) return;
        saving_edit = true;
        try {
            await api.update_project(editing_id, { name: edit_name.trim(), description: edit_description.trim() || null } as Partial<Project>);
            editing_id = null;
            await load_projects();
        }
        catch (error) {
            console.error('Failed to update project:', error);
            toast_store.error('Failed to update project');
        }
        finally {
            saving_edit = false;
        }
    }

    const filter_options: FilterStatus[] = ['All', 'Active', 'Archived'];

    onMount(() => {
        load_projects();
    });
</script>

<div class="page">
    <div class="page-header">
        <h2>Projects</h2>
        <div class="header-actions">
            {#if projects.length > 0}
                <label class="select-all-label">
                    <input type="checkbox" checked={all_selected} onchange={toggle_all} /> Select all
                </label>
            {/if}
            {#if selected_ids.size > 0}
                <Button variant="danger" icon="delete" onclick={confirm_delete_selected} disabled={deleting_selected}>
                    Delete {selected_ids.size}
                </Button>
            {/if}
            <Button variant="primary" icon={show_create ? 'close' : 'add'} onclick={() => (show_create = !show_create)}>
                {show_create ? 'Cancel' : 'New Project'}
            </Button>
        </div>
    </div>

    <ProjectCreateForm show={show_create} bind:new_name bind:new_description {creating} on_create={create_project} />

    {#if !loading && projects.length > 0}
        <div class="search-filter-bar">
            <div class="search-box">
                <span class="icon search-icon">search</span>
                <Input type="text" placeholder="Search projects…" bind:value={search_query} class="search-input" />
            </div>
            <div class="filter-pills">
                {#each filter_options as filter (filter)}
                    <button
                        class="filter-pill"
                        class:active={active_filter === filter}
                        onclick={() => (active_filter = filter)}
                    >
                        {filter}
                    </button>
                {/each}
            </div>
        </div>
        <p class="result-count">Showing {filtered_projects.length} of {projects.length} projects</p>
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
                    editing={editing_id === project.id}
                    selected={selected_ids.has(project.id)}
                    bind:edit_name
                    bind:edit_description
                    {saving_edit}
                    on_start_edit={start_edit}
                    on_cancel_edit={cancel_edit}
                    on_save_edit={save_edit}
                    on_delete={delete_project}
                    on_archive={archive_project}
                    on_unarchive={unarchive_project}
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
    onconfirm={handle_confirm_delete}
    oncancel={() => (confirm_delete_id = null)}
/>

<ConfirmModal
    title="Delete Projects"
    message={`Delete ${selected_ids.size} project(s) and all their features? This cannot be undone.`}
    confirm_label="Delete All"
    variant="danger"
    open={confirm_bulk_delete}
    onconfirm={delete_selected}
    oncancel={() => (confirm_bulk_delete = false)}
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
    .search-filter-bar {
        display: flex; align-items: center; gap: 1rem;
        margin-bottom: 0.75rem; flex-wrap: wrap;
    }
    .search-box {
        position: relative; flex: 1; min-width: 200px;
    }
    .search-icon {
        position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%);
        font-size: 18px; color: var(--fg-muted); pointer-events: none;
    }
    :global(.search-input) { padding-left: 2.2rem !important; }
    .filter-pills { display: flex; gap: 0.35rem; }
    .filter-pill {
        padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--border);
        background: transparent; color: var(--fg-muted); font-size: 0.8rem;
        cursor: pointer; transition: all 0.15s; font-family: var(--font);
    }
    .filter-pill:hover { border-color: var(--accent); color: var(--fg); }
    .filter-pill.active {
        background: var(--accent); color: var(--bg); border-color: var(--accent);
    }
    .result-count {
        font-size: 0.75rem; color: var(--fg-muted); margin-bottom: 1rem;
    }
    .project-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;
    }
    @media (max-width: 768px) {
        .project-grid { grid-template-columns: 1fr; }
    }
</style>

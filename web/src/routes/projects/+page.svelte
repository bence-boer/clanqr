<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Project } from '$lib/types';
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import ProjectCard from './ProjectCard.svelte';
    import ProjectCreateForm from './ProjectCreateForm.svelte';

    let projects = $state<Project[]>([]);
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

    let all_selected = $derived(projects.length > 0 && selected_ids.size === projects.length);

    function toggle_select(id: string) {
        const next = new SvelteSet(selected_ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selected_ids = next;
    }

    function toggle_all() {
        selected_ids = all_selected ? new Set() : new Set(projects.map((p) => p.id));
    }

    async function load_projects() {
        try {
            projects = await api.list_projects();
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

    async function delete_selected() {
        if (selected_ids.size === 0) return;
        if (!confirm(`Delete ${selected_ids.size} project(s) and all their features?`)) return;
        deleting_selected = true;
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
        if (!confirm('Delete this project and all its features?')) return;
        try {
            await api.delete_project(id);
            await load_projects();
        }
        catch (error) {
            console.error('Failed to delete project:', error);
            toast_store.error('Failed to delete project');
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
                <Button variant="danger" icon="delete" onclick={delete_selected} disabled={deleting_selected}>
                    Delete {selected_ids.size}
                </Button>
            {/if}
            <Button variant="primary" icon={show_create ? 'close' : 'add'} onclick={() => (show_create = !show_create)}>
                {show_create ? 'Cancel' : 'New Project'}
            </Button>
        </div>
    </div>

    <ProjectCreateForm show={show_create} bind:new_name bind:new_description {creating} on_create={create_project} />

    {#if loading}
        <LoadingSpinner label="Loading projects..." />
    {:else if projects.length === 0}
        <EmptyState icon="folder" message="No projects yet" detail="Create one to get started." />
    {:else}
        <div class="project-grid">
            {#each projects as project (project.id)}
                <ProjectCard
                    {project}
                    editing={editing_id === project.id}
                    selected={selected_ids.has(project.id)}
                    bind:edit_name
                    bind:edit_description
                    {saving_edit}
                    on_start_edit={start_edit}
                    on_cancel_edit={cancel_edit}
                    on_save_edit={save_edit}
                    on_delete={delete_project}
                    on_toggle_select={toggle_select}
                />
            {/each}
        </div>
    {/if}
</div>

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

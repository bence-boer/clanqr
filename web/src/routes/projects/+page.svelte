<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, LoadingSpinner } from '$lib/components';
    import { Badge, Button, Input, Textarea } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Project } from '$lib/types';
    import { onMount } from 'svelte';

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
        const next = new Set(selected_ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selected_ids = next;
    }

    function toggle_all() {
        if (all_selected) {
            selected_ids = new Set();
        } else {
            selected_ids = new Set(projects.map((p) => p.id));
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
        } catch (error) {
            console.error('Failed to delete projects:', error);
            toast_store.error('Failed to delete projects');
        } finally {
            deleting_selected = false;
        }
    }

    async function load_projects() {
        try {
            projects = await api.list_projects();
        } catch (error) {
            console.error('Failed to load projects:', error);
            toast_store.error('Failed to load projects');
        } finally {
            loading = false;
        }
    }

    async function create_project() {
        if (!new_name.trim()) return;
        creating = true;
        try {
            await api.create_project({
                name: new_name.trim(),
                description: new_description.trim() || undefined
            });
            new_name = '';
            new_description = '';
            show_create = false;
            await load_projects();
        } catch (error) {
            console.error('Failed to create project:', error);
            toast_store.error('Failed to create project');
        } finally {
            creating = false;
        }
    }

    async function delete_project(id: string) {
        if (!confirm('Delete this project and all its features?')) return;
        try {
            await api.delete_project(id);
            await load_projects();
        } catch (error) {
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
        } catch (error) {
            console.error('Failed to update project:', error);
            toast_store.error('Failed to update project');
        } finally {
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
                    <input type="checkbox" checked={all_selected} onchange={toggle_all} />
                    Select all
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

    {#if show_create}
        <form
            class="create-form"
            onsubmit={(event) => {
                event.preventDefault();
                create_project();
            }}
        >
            <Input type="text" placeholder="Project name" bind:value={new_name} class="input" required />
            <Textarea placeholder="Description (optional)" bind:value={new_description} rows={2} />
            <Button type="submit" variant="primary" disabled={creating || !new_name.trim()}>
                {creating ? 'Creating...' : 'Create Project'}
            </Button>
        </form>
    {/if}

    {#if loading}
        <LoadingSpinner label="Loading projects..." />
    {:else if projects.length === 0}
        <EmptyState icon="folder" message="No projects yet" detail="Create one to get started." />
    {:else}
        <div class="project-grid">
            {#each projects as project}
                {#if editing_id === project.id}
                    <div class="project-card editing">
                        <Input type="text" class="input" bind:value={edit_name} placeholder="Project name" />
                        <Textarea bind:value={edit_description} placeholder="Description" rows={2} />
                        <div class="project-footer">
                            <Button variant="secondary" size="sm" onclick={cancel_edit}>Cancel</Button>
                            <Button variant="primary" size="sm" onclick={save_edit} disabled={saving_edit || !edit_name.trim()}>
                                {saving_edit ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                {:else}
                    <a href="/projects/{project.id}" class="project-card" class:selected-card={selected_ids.has(project.id)}>
                        <div class="project-header">
                            <div class="project-header-left">
                                <input
                                    type="checkbox"
                                    checked={selected_ids.has(project.id)}
                                    onclick={(event: MouseEvent) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        toggle_select(project.id);
                                    }}
                                />
                                <h3>{project.name}</h3>
                            </div>
                            <Badge
                                variant={project.status.toLowerCase() === 'active'
                                    ? 'success'
                                    : project.status.toLowerCase() === 'archived'
                                      ? 'muted'
                                      : 'default'}>{project.status}</Badge
                            >
                        </div>
                        <p class="project-desc">{project.description ?? 'No description'}</p>
                        <div class="project-footer">
                            <span class="date">
                                <span class="icon" style="font-size:14px">calendar_today</span>
                                {new Date(project.created_at).toLocaleDateString()}
                            </span>
                            <div class="project-card-actions">
                                <Button variant="secondary" size="sm" icon="edit" onclick={(event: Event) => start_edit(project, event as MouseEvent)} />
                                <Button
                                    variant="danger"
                                    size="sm"
                                    icon="delete"
                                    onclick={(event: Event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        delete_project(project.id);
                                    }}
                                />
                            </div>
                        </div>
                    </a>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    .page {
        max-width: 900px;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .select-all-label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8rem;
        color: var(--fg-muted);
        cursor: pointer;
    }

    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }

    .create-form {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
    }

    .project-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s;
    }

    .project-card:hover {
        border-color: var(--accent);
    }

    .project-card.editing {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .project-card-actions {
        display: flex;
        gap: 0.35rem;
    }

    .project-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .project-header-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .selected-card {
        border-color: var(--accent);
    }

    .project-header h3 {
        font-size: 1.05rem;
        color: var(--fg);
    }

    .project-desc {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin-bottom: 0.75rem;
    }

    .project-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .date {
        font-size: 0.75rem;
        color: var(--fg-muted);
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }

    @media (max-width: 768px) {
        .project-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

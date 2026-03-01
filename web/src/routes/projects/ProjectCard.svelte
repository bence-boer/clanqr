<script lang="ts">
    import { resolve } from '$app/paths';
    import { Badge, Button, Input, Textarea } from '$lib/components/primitives';
    import type { Project } from '$lib/types';

    interface Props {
        project: Project
        editing: boolean
        selected: boolean
        edit_name: string
        edit_description: string
        saving_edit: boolean
        on_start_edit: (project: Project, event: MouseEvent) => void
        on_cancel_edit: (event: MouseEvent) => void
        on_save_edit: (event: MouseEvent) => void
        on_delete: (id: string) => void
        on_toggle_select: (id: string) => void
    }

    let {
        project, editing, selected,
        edit_name = $bindable(), edit_description = $bindable(),
        saving_edit, on_start_edit, on_cancel_edit, on_save_edit,
        on_delete, on_toggle_select
    }: Props = $props();
</script>

{#if editing}
    <div class="project-card editing">
        <Input type="text" class="input" bind:value={edit_name} placeholder="Project name" />
        <Textarea bind:value={edit_description} placeholder="Description" rows={2} />
        <div class="project-footer">
            <Button variant="secondary" size="sm" onclick={on_cancel_edit}>Cancel</Button>
            <Button variant="primary" size="sm" onclick={on_save_edit} disabled={saving_edit || !edit_name.trim()}>
                {saving_edit ? 'Saving...' : 'Save'}
            </Button>
        </div>
    </div>
{:else}
    <a href={resolve(`/projects/${project.id}`)} class="project-card" class:selected-card={selected}>
        <div class="project-header">
            <div class="project-header-left">
                <input
                    type="checkbox"
                    checked={selected}
                    onclick={(event: MouseEvent) => {
                        event.preventDefault();
                        event.stopPropagation();
                        on_toggle_select(project.id);
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
                <Button variant="secondary" size="sm" icon="edit" onclick={(event: Event) => on_start_edit(project, event as MouseEvent)} />
                <Button
                    variant="danger"
                    size="sm"
                    icon="delete"
                    onclick={(event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        on_delete(project.id);
                    }}
                />
            </div>
        </div>
    </a>
{/if}

<style>
    .project-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s;
    }
    .project-card:hover { border-color: var(--accent); }
    .project-card.editing { display: flex; flex-direction: column; gap: 0.5rem; }
    .project-card-actions { display: flex; gap: 0.35rem; }
    .project-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 0.5rem; gap: 0.5rem; flex-wrap: wrap;
    }
    .project-header-left { display: flex; align-items: center; gap: 0.5rem; }
    .selected-card { border-color: var(--accent); }
    .project-header h3 { font-size: 1.05rem; color: var(--fg); }
    .project-desc { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.75rem; }
    .project-footer {
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: 0.5rem;
    }
    .date {
        font-size: 0.75rem; color: var(--fg-muted);
        display: inline-flex; align-items: center; gap: 0.25rem;
    }
</style>

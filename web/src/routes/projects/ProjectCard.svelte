<script lang="ts">
    import { resolve } from '$app/paths';
    import { Checkbox } from '$lib/components';
    import { Badge, Button, Input, Textarea } from '$lib/components/primitives';
    import type { Feature, Project } from '$lib/types';

    interface Props {
        project: Project
        features: Feature[]
        selected: boolean
        on_save: (id: string, name: string, description: string) => Promise<boolean>
        on_delete: (id: string) => void
        on_archive: (id: string) => void
        on_unarchive: (id: string) => void
        on_toggle_select: (id: string) => void
    }

    let {
        project, features, selected,
        on_save, on_delete, on_archive, on_unarchive, on_toggle_select
    }: Props = $props();

    let editing = $state(false);
    let edit_name = $state('');
    let edit_description = $state('');
    let saving_edit = $state(false);

    const feature_count = $derived(features.length);
    const completed_count = $derived(features.filter((f) => f.status === 'done').length);
    const last_updated = $derived.by(() => {
        if (features.length === 0) return null;
        const dates = features.map((f) => new Date(f.updated_at ?? f.created_at).getTime());
        return new Date(Math.max(...dates));
    });

    function format_relative(date: Date): string {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    const is_archived = $derived(project.status === 'archived');

    function start_edit(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        editing = true;
        edit_name = project.name;
        edit_description = project.description ?? '';
    }

    function cancel_edit(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        editing = false;
    }

    async function save_edit(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (!edit_name.trim()) return;
        saving_edit = true;
        try {
            if (await on_save(project.id, edit_name, edit_description)) {
                editing = false;
            }
        }
        finally {
            saving_edit = false;
        }
    }
</script>

{#if editing}
    <div class="project-card editing">
        <Input type="text" class="input" bind:value={edit_name} placeholder="Project name" aria-label="Project name" />
        <Textarea bind:value={edit_description} placeholder="Description" rows={2} aria-label="Project description" />
        <div class="project-footer">
            <Button variant="secondary" size="sm" onclick={cancel_edit}>Cancel</Button>
            <Button variant="primary" size="sm" onclick={save_edit} disabled={saving_edit || !edit_name.trim()}>
                {saving_edit ? 'Saving...' : 'Save'}
            </Button>
        </div>
    </div>
{:else}
    <a href={resolve(`/projects/${project.id}`)} class="project-card" class:selected-card={selected}>
        <div class="project-header">
            <div class="project-header-left">
                <Checkbox
                    checked={selected}
                    onclick={(event: MouseEvent) => {
                        event.stopPropagation();
                        on_toggle_select(project.id);
                    }}
                    aria-label="Select {project.name}"
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
        <div class="card-summary">
            <span class="summary-item">
                <span class="icon" style="font-size:14px">category</span>
                {feature_count} feature{feature_count !== 1 ? 's' : ''}
            </span>
            {#if feature_count > 0}
                <span class="summary-item">
                    <span class="icon" style="font-size:14px">check_circle</span>
                    {completed_count}/{feature_count} done
                </span>
            {/if}
            {#if last_updated}
                <span class="summary-item">
                    <span class="icon" style="font-size:14px">schedule</span>
                    Updated {format_relative(last_updated)}
                </span>
            {/if}
        </div>
        <div class="project-footer">
            <span class="date">
                <span class="icon" style="font-size:14px">calendar_today</span>
                {new Date(project.created_at).toLocaleDateString()}
            </span>
            <div class="project-card-actions">
                <Button variant="secondary" size="sm" icon="edit" onclick={start_edit} aria-label="Edit project" />
                {#if is_archived}
                    <Button variant="secondary" size="sm" icon="unarchive" aria-label="Unarchive project" onclick={(event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        on_unarchive(project.id);
                    }} />
                {:else}
                    <Button variant="secondary" size="sm" icon="archive" aria-label="Archive project" onclick={(event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        on_archive(project.id);
                    }} />
                {/if}
                <Button
                    variant="danger"
                    size="sm"
                    icon="delete"
                    aria-label="Delete project"
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
    .project-desc { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 0.5rem; }
    .card-summary {
        display: flex; gap: 0.75rem; flex-wrap: wrap;
        margin-bottom: 0.75rem; font-size: 0.75rem; color: var(--fg-muted);
    }
    .summary-item {
        display: inline-flex; align-items: center; gap: 0.2rem;
    }
    .project-footer {
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: 0.5rem;
    }
    .date {
        font-size: 0.75rem; color: var(--fg-muted);
        display: inline-flex; align-items: center; gap: 0.25rem;
    }
</style>

<script lang="ts">
    import { resolve } from '$app/paths';
    import { StatusBadge } from '$lib/components';
    import type { Task } from '$lib/types';

    interface Props {
        task: Task
        index: number
        is_dragging: boolean
        is_drop_above: boolean
        is_drop_below: boolean
        ondragstart: (e: DragEvent) => void
        ondragover: (e: DragEvent) => void
        ondragleave: () => void
        ondrop: (e: DragEvent) => void
        ondragend: () => void
        on_remove: () => void
    }

    let {
        task, index, is_dragging, is_drop_above, is_drop_below,
        ondragstart, ondragover, ondragleave, ondrop, ondragend, on_remove
    }: Props = $props();

    let task_title = $derived(task.title ?? task.description?.slice(0, 80) ?? 'Untitled task');
</script>

<div
    class="queue-item"
    class:dragging={is_dragging}
    class:drop-above={is_drop_above}
    class:drop-below={is_drop_below}
    draggable="true"
    {ondragstart}
    {ondragover}
    {ondragleave}
    {ondrop}
    {ondragend}
    role="listitem"
>
    <span class="drag-handle" title="Drag to reorder">⠿</span>
    <span class="queue-number">{index + 1}</span>
    <div class="queue-content">
        <div class="queue-header">
            <div class="queue-breadcrumb">
                {#if task.features?.projects?.name}
                    {#if task.features?.projects?.id}
                        <a href={resolve(`/projects/${task.features.projects.id}`)} class="crumb-link">{task.features.projects.name}</a>
                    {:else}
                        <span class="crumb-text">{task.features.projects.name}</span>
                    {/if}
                {/if}

                {#if task.features?.title}
                    {#if task.features?.projects?.name}
                        <span class="crumb-sep">/</span>
                    {/if}
                    {#if task.features?.id && task.features.projects?.id}
                        <a href={resolve(`/projects/${task.features.projects.id}?feature=${task.features.id}`)} class="crumb-link">{task.features.title}</a>
                    {:else}
                        <span class="crumb-text">{task.features.title}</span>
                    {/if}
                {/if}
            </div>

            <div class="queue-header-right">
                <StatusBadge status={task.status} />
                <button class="remove-btn" title="Remove from queue" onclick={on_remove}>×</button>
            </div>
        </div>
        <h4 class="queue-title">{task_title}</h4>
        {#if task.title}
            <p class="queue-desc">{task.description}</p>
        {/if}
    </div>
</div>

<style>
    .queue-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.6rem 0.85rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        cursor: grab;
        transition: opacity 150ms, border-color 150ms;
    }

    .queue-item:active { cursor: grabbing; }
    .queue-item.dragging { opacity: 0.4; }
    .queue-item.drop-above { border-top: 2px solid var(--accent); }
    .queue-item.drop-below { border-bottom: 2px solid var(--accent); }

    .drag-handle {
        font-size: 1rem;
        color: var(--fg-muted);
        cursor: grab;
        user-select: none;
        padding-top: 0.1rem;
        opacity: 0.5;
        transition: opacity 150ms;
    }

    .queue-item:hover .drag-handle { opacity: 1; }

    .queue-number {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--fg-muted);
        min-width: 1.2rem;
        text-align: center;
        padding-top: 0.1rem;
    }

    .queue-content { flex: 1; min-width: 0; }

    .queue-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .queue-header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .remove-btn {
        background: none;
        border: none;
        color: var(--fg-muted);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0 0.2rem;
        line-height: 1;
        border-radius: var(--radius);
        opacity: 0;
        transition: opacity 150ms, color 150ms;
    }

    .queue-item:hover .remove-btn { opacity: 1; }
    .remove-btn:hover { color: var(--danger); }

    .queue-breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
        flex-wrap: wrap;
    }

    .crumb-link { color: var(--accent); text-decoration: none; font-weight: 500; }
    .crumb-link:hover { text-decoration: underline; }
    .crumb-text { color: var(--fg-muted); }
    .crumb-sep { color: var(--border); font-size: 0.75rem; }

    .queue-title {
        font-size: 0.9rem;
        color: var(--fg);
        font-weight: 600;
        line-height: 1.4;
        margin-top: 0.25rem;
    }

    .queue-desc {
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-top: 0.2rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 768px) {
        .queue-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }

        .queue-header {
            flex-direction: column;
            gap: 0.35rem;
        }

        .remove-btn { opacity: 1; }
    }
</style>

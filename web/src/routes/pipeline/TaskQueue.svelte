<script lang="ts">
    import { resolve } from '$app/paths';
    import { ConfirmModal, EmptyState, StatusBadge } from '$lib/components';
    import { Badge } from '$lib/components/primitives';
    import type { Task } from '$lib/types';

    let {
        queue,
        onreorder,
        onremove
    }: {
        queue: Task[]
        onreorder: (task_ids: string[]) => void
        onremove: (task_id: string) => void
    } = $props();

    let drag_index = $state<number | null>(null);
    let drop_index = $state<number | null>(null);

    // Remove-from-queue modal state
    let remove_target = $state<Task | null>(null);
    let remove_open = $state(false);

    function handle_drag_start(e: DragEvent, index: number) {
        drag_index = index;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
        }
    }

    function handle_drag_over(e: DragEvent, index: number) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        drop_index = index;
    }

    function handle_drag_leave() {
        drop_index = null;
    }

    function handle_drop(e: DragEvent, index: number) {
        e.preventDefault();
        if (drag_index === null || drag_index === index) {
            drag_index = null;
            drop_index = null;
            return;
        }
        const reordered = [...queue];
        const [moved] = reordered.splice(drag_index, 1);
        reordered.splice(index, 0, moved);
        queue = reordered;
        onreorder(reordered.map(t => t.id));
        drag_index = null;
        drop_index = null;
    }

    function handle_drag_end() {
        drag_index = null;
        drop_index = null;
    }

    function request_remove(task: Task) {
        remove_target = task;
        remove_open = true;
    }

    function confirm_remove() {
        if (remove_target) {
            onremove(remove_target.id);
        }
        remove_open = false;
        remove_target = null;
    }

    function cancel_remove() {
        remove_open = false;
        remove_target = null;
    }
</script>

<section class="section">
    <h3 class="section-title">
        <span class="icon">queue</span>
        Queue
        {#if queue.length > 0}
            <Badge variant="muted">{queue.length}</Badge>
        {/if}
    </h3>

    {#if queue.length === 0}
        <EmptyState icon="done_all" message="No tasks waiting in queue" />
    {:else}
        <div class="queue-list">
            {#each queue as task, i (task.id)}
                {@const task_title = task.title ?? task.description?.slice(0, 80) ?? 'Untitled task'}
                <div
                    class="queue-item"
                    class:dragging={drag_index === i}
                    class:drop-above={drop_index === i && drag_index !== null && drag_index > i}
                    class:drop-below={drop_index === i && drag_index !== null && drag_index < i}
                    draggable="true"
                    ondragstart={(e) => handle_drag_start(e, i)}
                    ondragover={(e) => handle_drag_over(e, i)}
                    ondragleave={handle_drag_leave}
                    ondrop={(e) => handle_drop(e, i)}
                    ondragend={handle_drag_end}
                    role="listitem"
                >
                    <span class="drag-handle" title="Drag to reorder">⠿</span>
                    <span class="queue-number">{i + 1}</span>
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
                                <button
                                    class="remove-btn"
                                    title="Remove from queue"
                                    onclick={() => request_remove(task)}
                                >×</button>
                            </div>
                        </div>
                        <h4 class="queue-title">{task_title}</h4>
                        {#if task.title}
                            <p class="queue-desc">{task.description}</p>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</section>

<ConfirmModal
    bind:open={remove_open}
    title="Remove from queue"
    message="Remove '{remove_target?.title ?? remove_target?.description?.slice(0, 40) ?? 'task'}' from queue? It will need to be re-approved."
    confirm_label="Remove"
    variant="warning"
    onconfirm={confirm_remove}
    oncancel={cancel_remove}
/>

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .queue-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

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

    .queue-item:active {
        cursor: grabbing;
    }

    .queue-item.dragging {
        opacity: 0.4;
    }

    .queue-item.drop-above {
        border-top: 2px solid var(--accent);
    }

    .queue-item.drop-below {
        border-bottom: 2px solid var(--accent);
    }

    .drag-handle {
        font-size: 1rem;
        color: var(--fg-muted);
        cursor: grab;
        user-select: none;
        padding-top: 0.1rem;
        opacity: 0.5;
        transition: opacity 150ms;
    }

    .queue-item:hover .drag-handle {
        opacity: 1;
    }

    .queue-number {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--fg-muted);
        min-width: 1.2rem;
        text-align: center;
        padding-top: 0.1rem;
    }

    .queue-content {
        flex: 1;
        min-width: 0;
    }

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

    .queue-item:hover .remove-btn {
        opacity: 1;
    }

    .remove-btn:hover {
        color: var(--danger);
    }

    .queue-breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
        flex-wrap: wrap;
    }

    .crumb-link {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
    }

    .crumb-link:hover {
        text-decoration: underline;
    }

    .crumb-text {
        color: var(--fg-muted);
    }

    .crumb-sep {
        color: var(--border);
        font-size: 0.75rem;
    }

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

        .remove-btn {
            opacity: 1;
        }
    }
</style>

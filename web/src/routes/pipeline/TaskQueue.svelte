<script lang="ts">
    import { ConfirmModal, EmptyState } from '$lib/components';
    import { Badge } from '$lib/components/primitives';
    import type { Task } from '$lib/types';
    import TaskQueueItem from './TaskQueueItem.svelte';

    let {
        queue,
        on_reorder,
        on_remove
    }: {
        queue: Task[]
        on_reorder: (task_ids: string[]) => void
        on_remove: (task_id: string) => void
    } = $props();

    let drag_index = $state<number | null>(null);
    let drop_index = $state<number | null>(null);
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
        on_reorder(reordered.map((t) => t.id));
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
            on_remove(remove_target.id);
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
                <TaskQueueItem
                    {task}
                    index={i}
                    is_dragging={drag_index === i}
                    is_drop_above={drop_index === i && drag_index !== null && drag_index > i}
                    is_drop_below={drop_index === i && drag_index !== null && drag_index < i}
                    ondragstart={(e) => handle_drag_start(e, i)}
                    ondragover={(e) => handle_drag_over(e, i)}
                    ondragleave={handle_drag_leave}
                    ondrop={(e) => handle_drop(e, i)}
                    ondragend={handle_drag_end}
                    on_remove={() => request_remove(task)}
                />
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
    on_confirm={confirm_remove}
    on_cancel={cancel_remove}
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
</style>

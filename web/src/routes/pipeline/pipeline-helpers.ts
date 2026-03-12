import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';

export function format_duration(started_at: string | null): string {
    if (!started_at) return '';
    const elapsed = Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const m = Math.floor(elapsed / 60);
    return `${m}m ${elapsed % 60}s`;
}

export async function reorder_queue(task_ids: string[], reload: () => Promise<void>): Promise<void> {
    try {
        await api.pipeline_reorder(task_ids);
    }
    catch (err) {
        console.error('Failed to reorder queue:', err);
        toast_store.error('Failed to reorder queue');
        await reload();
    }
}

export async function remove_from_queue(task_id: string, reload: () => Promise<void>): Promise<void> {
    try {
        await api.update_task(task_id, { status: 'Pending_Approval' } as never);
        await reload();
    }
    catch (err) {
        console.error('Failed to remove from queue:', err);
        toast_store.error('Failed to remove from queue');
    }
}

export async function retry_task(task_id: string, reload: () => Promise<void>): Promise<void> {
    try {
        await api.approve_task(task_id);
        await reload();
    }
    catch (err) {
        console.error('Failed to retry task:', err);
        toast_store.error('Failed to retry task');
    }
}

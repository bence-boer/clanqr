import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';
import type { Feature } from '$lib/types';

/** Wraps an API call with error logging and toast notification */
async function safe_call(fn: () => Promise<unknown>, error_label: string, on_done?: () => Promise<void>) {
    try {
        await fn();
        await on_done?.();
    }
    catch (error) {
        console.error(`Failed to ${error_label}:`, error);
        toast_store.error(`Failed to ${error_label}`);
    }
}

export function create_feature_handlers(get_feature: () => Feature, on_update: () => Promise<void>) {
    return {
        approve: (task_id: string) => safe_call(() => api.approve_task(task_id), 'approve task', on_update),
        approve_all: (feature_id: string) => safe_call(() => api.approve_all_tasks(feature_id), 'approve tasks', on_update),
        spawn: (task_id: string) => safe_call(() => api.spawn_ralph(task_id), 'spawn ralph', on_update),
        add_task: (description: string) => safe_call(() => api.create_task({ feature_id: get_feature().id, description }), 'add task', on_update),
        update_task: (task_id: string, description: string, title?: string | null) => safe_call(() => api.update_task(task_id, { description, title }), 'update task', on_update),
        delete_task: async (task_id: string) => {
            if (!confirm('Delete this task?')) return;
            await safe_call(() => api.delete_task(task_id), 'delete task', on_update);
        },
        toggle_auto_approve: (enabled: boolean) => safe_call(
            () => api.update_feature(get_feature().id, { auto_approve: enabled } as Partial<Feature>),
            'update auto-approve', on_update
        ),
        add_resource: async (url: string, title?: string) => {
            await safe_call(() => api.add_resource(get_feature().id, { url, title }), 'add resource', on_update);
        },
        remove_resource: (resource_id: string) => safe_call(() => api.delete_resource(get_feature().id, resource_id), 'delete resource', on_update),
        save_edit: async (data: {
            title: string
            description?: string | null
        }) => {
            await safe_call(() => api.update_feature(get_feature().id, data as Partial<Feature>), 'update feature', on_update);
        }
    };
}

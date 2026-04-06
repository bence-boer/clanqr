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
        add_dependency: (task_id: string, depends_on: string) => safe_call(() => api.add_task_dependency(task_id, depends_on), 'add dependency', on_update),
        remove_dependency: (task_id: string, dep_id: string) => safe_call(() => api.remove_task_dependency(task_id, dep_id), 'remove dependency', on_update),
        verify_task: (task_id: string) => safe_call(() => api.verify_task(task_id), 'verify task', on_update),
        toggle_auto_approve: (enabled: boolean) => safe_call(
            () => api.update_feature(get_feature().id, { auto_approve: enabled }),
            'update auto-approve', on_update
        ),
        add_resource: async (url: string, title?: string) => {
            await safe_call(() => api.add_resource(get_feature().id, { url, title }), 'add resource', on_update);
        },
        remove_resource: (resource_id: string) => safe_call(() => api.delete_resource(get_feature().id, resource_id), 'delete resource', on_update),
        save_edit: async (data: {
            title: string
            description?: string | null
            planning_model: string | null
            execution_model: string | null
        }) => {
            await safe_call(() => api.update_feature(get_feature().id, data), 'update feature', on_update);
        }
    };
}

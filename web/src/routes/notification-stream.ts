import { API_URL } from '$lib/api/rpc';
import { notification_store } from '$lib/stores/notifications.svelte';

export function create_notification_stream(): EventSource {
    const es = new EventSource(`${API_URL}/api/events/stream`, { withCredentials: true });

    es.addEventListener('features:update', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            if (data.status === 'Complete') {
                notification_store.add({ type: 'success', message: 'Feature completed', link: `/projects?feature=${data.feature_id}` });
            }
            if (data.status === 'Failed') {
                notification_store.add({ type: 'danger', message: 'Feature failed', link: `/projects?feature=${data.feature_id}` });
            }
        }
        catch {
            /* ignore malformed */
        }
    });

    es.addEventListener('tasks:update', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            if (data.status === 'Failed') {
                notification_store.add({ type: 'danger', message: 'Task failed', link: `/projects?feature=${data.feature_id}` });
            }
        }
        catch {
            /* ignore malformed */
        }
    });

    es.addEventListener('pipeline:status', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            if (data.state === 'paused') {
                notification_store.add({ type: 'warning', message: 'Pipeline paused' });
            }
        }
        catch {
            /* ignore malformed */
        }
    });

    return es;
}

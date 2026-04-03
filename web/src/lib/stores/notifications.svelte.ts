import { generate_id } from '$lib/utils/id';

export interface Notification {
    id: string
    type: 'danger' | 'success' | 'warning' | 'info'
    message: string
    link?: string
    timestamp: string
    read: boolean
}

class NotificationStore {
    items = $state<Notification[]>([]);

    get unread_count() {
        return this.items.filter((n) => !n.read).length;
    }

    add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
        this.items.unshift({
            ...notification,
            id: generate_id(),
            timestamp: new Date().toISOString(),
            read: false
        });
        if (this.items.length > 50) this.items.pop();
    }

    mark_read(id: string) {
        const item = this.items.find((n) => n.id === id);
        if (item) item.read = true;
    }

    mark_all_read() {
        this.items.forEach((n) => n.read = true);
    }

    clear() {
        this.items = [];
    }
}

export const notification_store = new NotificationStore();

import { generate_id } from '$lib/utils/id';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string
    message: string
    type: ToastType
}

class ToastStore {
    items: Toast[] = $state([]);
    private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    show(message: string, type: ToastType = 'info') {
        const id = generate_id();
        this.items.push({ id, message, type });
        if (this.items.length > 20) {
            const removed = this.items.shift();
            if (removed) {
                const timer = this.timers.get(removed.id);
                if (timer) {
                    clearTimeout(timer);
                    this.timers.delete(removed.id);
                }
            }
        }
        const dismiss_ms = type === 'error' ? 10000 : 5000;
        this.timers.set(id, setTimeout(() => this.dismiss(id), dismiss_ms));
    }

    dismiss(id: string) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
        this.items = this.items.filter((t) => t.id !== id);
    }

    success(message: string) {
        this.show(message, 'success');
    }

    error(message: string) {
        this.show(message, 'error');
    }

    warning(message: string) {
        this.show(message, 'warning');
    }

    info(message: string) {
        this.show(message, 'info');
    }
}

export const toast_store = new ToastStore();

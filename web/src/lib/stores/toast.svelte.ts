export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string
    message: string
    type: ToastType
}

class ToastStore {
    items: Toast[] = $state([]);

    show(message: string, type: ToastType = 'info') {
        const id = crypto.randomUUID();
        this.items.push({ id, message, type });
        const dismiss_ms = type === 'error' ? 10000 : 5000;
        setTimeout(() => this.dismiss(id), dismiss_ms);
    }

    dismiss(id: string) {
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

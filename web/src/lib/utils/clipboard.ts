import { toast_store } from '$lib/stores/toast.svelte';

export async function copy_to_clipboard(text: string, label = 'Content'): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        toast_store.success(`${label} copied to clipboard`);
        return true;
    } catch {
        toast_store.error('Failed to copy — try selecting and copying manually');
        return false;
    }
}

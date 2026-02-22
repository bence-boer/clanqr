import { onMount } from "svelte";

/**
 * Sets up a polling interval that runs a callback immediately and then
 * at the specified interval. Automatically cleans up on component unmount.
 *
 * Must be called during component initialization (top-level script).
 */
export function use_polling(callback: () => Promise<void> | void, interval_ms: number): void {
    onMount(() => {
        callback();
        const id = setInterval(callback, interval_ms);
        return () => clearInterval(id);
    });
}

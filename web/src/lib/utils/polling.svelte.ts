import { onMount } from 'svelte';

/**
 * Sets up a polling interval that runs a callback immediately and then
 * at the specified interval. Automatically cleans up on component unmount.
 *
 * Returns `is_stale` (true when data hasn't refreshed for 3× the interval)
 * and `mark_success()` which should be called after successful data loads.
 *
 * Must be called during component initialization (top-level script).
 */
export function use_polling(callback: () => Promise<void> | void, interval_ms: number) {
    let last_success = $state(Date.now());
    let now_tick = $state(Date.now());
    const is_stale = $derived(now_tick - last_success > interval_ms * 3);

    onMount(() => {
        callback();
        const poll_id = setInterval(callback, interval_ms);
        const tick_id = setInterval(() => {
            now_tick = Date.now();
        }, 1000);
        return () => {
            clearInterval(poll_id);
            clearInterval(tick_id);
        };
    });

    return {
        get is_stale() {
            return is_stale;
        },
        mark_success() {
            last_success = Date.now();
        }
    };
}

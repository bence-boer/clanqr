/**
 * Concurrency control for SDK sessions.
 * Limits active sessions and provides queue wake-up callbacks.
 */
import { env } from '../env';
import { logger } from '../utils/logger';

let active_count = 0;
let on_freed_callback: (() => void) | null = null;

export function can_start_session(): boolean {
    return active_count < env.SDK_MAX_CONCURRENT_SESSIONS;
}

export function increment_session_count(): void {
    active_count++;
    logger.debug('Session count incremented', { service: 'session_pool', active: active_count });
}

export function decrement_session_count(): void {
    if (active_count > 0) active_count--;
    logger.debug('Session count decremented', { service: 'session_pool', active: active_count });
    if (on_freed_callback) {
        try {
            on_freed_callback();
        }
        catch {
            /* swallow */
        }
    }
}

export function set_on_session_freed(callback: () => void): void {
    on_freed_callback = callback;
}

export function get_session_concurrency(): { active: number, max: number } {
    return {
        active: active_count,
        max: env.SDK_MAX_CONCURRENT_SESSIONS
    };
}

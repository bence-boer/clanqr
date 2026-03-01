import { env } from '../env';

const MAX_CONCURRENT_AGENTS = env.MAX_CONCURRENT_AGENTS;
let active_agent_count = 0;
let on_agent_freed: (() => void) | null = null;

/** Check if another agent process can be spawned */
export function can_spawn_agent(): boolean {
    return active_agent_count < MAX_CONCURRENT_AGENTS;
}

/** Increment the active agent counter (call before spawning) */
export function increment_agent_count() {
    active_agent_count++;
}

/** Decrement the active agent counter (call in finally block after spawn) */
export function decrement_agent_count() {
    active_agent_count = Math.max(0, active_agent_count - 1);
    on_agent_freed?.();
}

/** Register a callback invoked whenever an agent slot is freed */
export function set_on_agent_freed(callback: () => void) {
    on_agent_freed = callback;
}

/** Current concurrency info for diagnostics */
export function get_agent_concurrency() {
    return { active: active_agent_count, max: MAX_CONCURRENT_AGENTS };
}

/**
 * Shared status mapping utilities.
 * Used by StatusBadge and any component that needs to map status strings
 * to Material Symbols icons or badge variants.
 */

import type { MaterialSymbol } from '$lib/types';

export type BadgeVariant = 'default' | 'muted' | 'info' | 'warning' | 'success' | 'danger';

const icon_map = {
    draft: 'edit_note',
    submitted: 'send',
    in_progress: 'sync',
    done: 'check_circle',
    pending_approval: 'pending',
    approved: 'thumb_up',
    complete: 'check_circle',
    completed: 'check_circle',
    pending: 'hourglass_empty',
    queued: 'add_to_queue',
    running: 'sync',
    failed: 'error',
    stopped: 'stop_circle',
    skipped: 'skip_next',
    fetched: 'check',
    error: 'error'
} as const satisfies Record<string, MaterialSymbol>;

export type StatusIcon = keyof typeof icon_map;

const variant_map = {
    draft: 'muted',
    submitted: 'info',
    in_progress: 'warning',
    done: 'success',
    pending_approval: 'warning',
    approved: 'info',
    complete: 'success',
    completed: 'success',
    pending: 'muted',
    queued: 'muted',
    running: 'warning',
    failed: 'danger',
    stopped: 'muted',
    skipped: 'warning',
    fetched: 'success',
    error: 'danger'
} as const satisfies Record<string, BadgeVariant>;

export type Variant = keyof typeof icon_map;

export function status_icon(status: string): string {
    return icon_map[status.toLowerCase() as StatusIcon] ?? 'help';
}

export function status_class(status: string): BadgeVariant {
    return variant_map[status.toLowerCase() as Variant] ?? 'muted';
}

/** Shared formatting utilities for duration, tokens, dates, and cost. */

export function format_duration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return '< 1s';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

export function format_relative(date_str: string | null): string {
    if (!date_str) return '-';
    const diff = Math.floor((Date.now() - new Date(date_str).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function format_tokens_short(
    prompt: number | null, completion: number | null
): string {
    if (prompt === null && completion === null) return '-';
    return ((prompt ?? 0) + (completion ?? 0)).toLocaleString();
}

export function format_tokens_detail(
    prompt: number | null, completion: number | null
): string | null {
    if (prompt === null && completion === null) return null;
    const parts: string[] = [];
    if (prompt !== null) parts.push(`${prompt.toLocaleString()} in`);
    if (completion !== null) parts.push(`${completion.toLocaleString()} out`);
    return parts.join(' / ');
}

export function format_datetime(date_str: string | null): string {
    if (!date_str) return '-';
    return new Date(date_str).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export function format_cost(n: number): string {
    if (n === 0) return '$0.00';
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
}

export function format_time(iso: string): string {
    return new Date(iso).toLocaleTimeString();
}

export function format_relative_short(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff_ms = now.getTime() - d.getTime();
    const diff_min = Math.floor(diff_ms / 60_000);
    if (diff_min < 1) return 'just now';
    if (diff_min < 60) return `${diff_min}m ago`;
    const diff_hr = Math.floor(diff_min / 60);
    if (diff_hr < 24) return `${diff_hr}h ago`;
    return `${Math.floor(diff_hr / 24)}d ago`;
}

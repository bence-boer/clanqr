<script lang="ts">
    type VerificationStatus = 'approved' | 'rejected' | 'pending' | 'skipped';

    interface StatusVisual {
        icon: string;
        color: string;
        label: string;
    }

    const STATUS_MAP: Record<VerificationStatus, StatusVisual> = {
        approved: { icon: 'check_circle', color: 'var(--success)', label: 'Approved' },
        rejected: { icon: 'cancel', color: 'var(--danger)', label: 'Rejected' },
        pending: { icon: 'hourglass_empty', color: 'var(--fg-muted)', label: 'Pending' },
        skipped: { icon: 'skip_next', color: 'var(--fg-muted)', label: 'Skipped' }
    };

    let { status }: { status: VerificationStatus } = $props();

    const visual = $derived(STATUS_MAP[status] ?? STATUS_MAP.pending);
</script>

<span class="verification-badge" style:--badge-color={visual.color} title={visual.label}>
    <span class="icon" style="font-size:14px">{visual.icon}</span>
    <span class="badge-label">{visual.label}</span>
</span>

<style>
    .verification-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
        background: color-mix(in srgb, var(--badge-color) 15%, transparent);
        color: var(--badge-color);
    }
</style>

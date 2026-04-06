<script lang="ts">
    import { AgentTypeBadge } from '$lib/components/agent-type-badge';
    import { VerificationBadge } from '$lib/components/verification-badge';
    import { StatusBadge } from '$lib/components/status-badge';
    import { Button } from '$lib/components/primitives';
    import type { DagNode } from '$lib/components/dag-graph';

    let {
        node,
        on_close,
        on_verify
    }: {
        node: DagNode | null
        on_close: () => void
        on_verify?: (task_id: string) => void
    } = $props();

    const can_verify = $derived(
        node != null && (node.status === 'completed')
        && (!node.verification_status || node.verification_status === 'pending')
    );
</script>

{#if node}
    <div class="detail-panel">
        <div class="detail-header">
            <h4 class="detail-title">{node.label}</h4>
            <button class="close-btn" onclick={on_close} aria-label="Close detail panel">
                <span class="icon" style="font-size:18px">close</span>
            </button>
        </div>

        <div class="detail-body">
            {#if node.description}
                <p class="detail-desc">{node.description}</p>
            {/if}

            <div class="detail-row">
                <span class="detail-label">Agent</span>
                <AgentTypeBadge agent_type={node.agent_type} size="sm" />
            </div>

            <div class="detail-row">
                <span class="detail-label">Status</span>
                <StatusBadge status={node.status} />
            </div>

            {#if node.verification_status}
                <div class="detail-row">
                    <span class="detail-label">Verification</span>
                    <VerificationBadge status={node.verification_status as 'approved' | 'rejected' | 'pending' | 'skipped'} />
                </div>
            {/if}

            {#if node.wave != null}
                <div class="detail-row">
                    <span class="detail-label">Wave</span>
                    <span class="detail-value">Wave {node.wave}</span>
                </div>
            {/if}

            {#if node.depends_on && node.depends_on.length > 0}
                <div class="detail-row">
                    <span class="detail-label">Dependencies</span>
                    <span class="detail-value">{node.depends_on.length} tasks</span>
                </div>
            {/if}
        </div>

        {#if can_verify && on_verify}
            <div class="detail-actions">
                <Button variant="primary" size="sm" icon="verified" onclick={() => on_verify(node.id)}>
                    Verify
                </Button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .detail-panel {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem;
        animation: slide-in 200ms ease;
    }

    @keyframes slide-in {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
    }

    .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .detail-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg);
        line-height: 1.3;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--fg-muted);
        cursor: pointer;
        padding: 0.15rem;
        border-radius: 4px;
        flex-shrink: 0;
    }

    .close-btn:hover { color: var(--fg); }
    .close-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }

    .detail-body {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .detail-desc {
        font-size: 0.8rem;
        color: var(--fg-muted);
        line-height: 1.4;
    }

    .detail-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .detail-label {
        font-size: 0.75rem;
        color: var(--fg-muted);
        font-weight: 500;
    }

    .detail-value {
        font-size: 0.8rem;
        color: var(--fg);
    }

    .detail-actions {
        margin-top: 0.75rem;
        display: flex;
        justify-content: flex-end;
    }
</style>

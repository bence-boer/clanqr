<script lang="ts">
    import { Badge, Button } from '$lib/components/primitives';
    import type { Trait } from '$lib/types';

    interface Props {
        trait: Trait
        assignment_count: number
        delete_confirming: boolean
        deleting: boolean
        on_edit: () => void
        on_confirm_delete: () => void
        on_request_delete: () => void
        on_cancel_delete: () => void
    }

    let { trait, assignment_count, delete_confirming, deleting, on_edit, on_confirm_delete, on_request_delete, on_cancel_delete }: Props = $props();

    function truncate(text: string | null, max_len = 80): string {
        if (!text) return '';
        return text.length > max_len ? text.slice(0, max_len) + '…' : text;
    }
</script>

<div class="trait-row">
    <div class="trait-main">
        <div class="trait-header-row">
            <span class="trait-name">{trait.name}</span>
            <div class="trait-badges">
                <Badge variant={trait.target === 'orchestrator' ? 'info' : trait.target === 'implementer' ? 'warning' : 'default'}>{trait.target}</Badge>
                {#if trait.is_global}<Badge variant="success">global</Badge>{/if}
                {#if assignment_count > 0}
                    <Badge variant="muted">Used in {assignment_count} task{assignment_count !== 1 ? 's' : ''}</Badge>
                {/if}
            </div>
        </div>
        {#if trait.description}<p class="trait-desc">{truncate(trait.description)}</p>{/if}
        <p class="trait-preview">{truncate(trait.content, 120)}</p>
    </div>
    <div class="trait-actions">
        {#if delete_confirming}
            <span class="confirm-text">Delete?</span>
            <Button variant="danger" size="sm" onclick={on_confirm_delete} disabled={deleting}>
                {deleting ? '…' : 'Yes'}
            </Button>
            <Button variant="secondary" size="sm" onclick={on_cancel_delete}>No</Button>
        {:else}
            <Button variant="secondary" size="sm" icon="edit" onclick={on_edit}>Edit</Button>
            <Button variant="danger" size="sm" icon="delete" onclick={on_request_delete} aria-label="Delete {trait.name}" />
        {/if}
    </div>
</div>

<style>
    .trait-row {
        display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.85rem 1.1rem; transition: border-color 0.15s; flex-wrap: wrap;
        max-width: 100%; overflow: hidden; box-sizing: border-box;
    }
    .trait-row:hover { border-color: var(--bg-elevated); }
    .trait-main { flex: 1; min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 0.2rem; }
    .trait-header-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .trait-name { font-weight: 600; color: var(--fg); font-size: 0.875rem; font-family: var(--font-mono); }
    .trait-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .trait-desc { font-size: 0.82rem; color: var(--fg-muted); }
    .trait-preview {
        font-size: 0.75rem; color: var(--fg-muted); opacity: 0.55;
        font-family: var(--font-mono);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .trait-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
    .confirm-text { font-size: 0.8rem; color: var(--danger); font-weight: 600; white-space: nowrap; }
    @media (max-width: 768px) {
        .trait-row { flex-direction: column; align-items: flex-start; }
        .trait-actions { align-self: flex-end; flex-wrap: wrap; }
    }
</style>

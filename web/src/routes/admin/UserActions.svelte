<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { User } from '$lib/types';

    let {
        user,
        self_id,
        admin_count,
        confirm_delete,
        role_toggling,
        deleting,
        on_toggle_role,
        on_delete,
        on_confirm_delete,
        on_cancel_delete
    }: {
        user: User
        self_id: string | null
        admin_count: number
        confirm_delete: string | null
        role_toggling: Set<string>
        deleting: Set<string>
        on_toggle_role: (user: User) => void
        on_delete: (user_id: string) => void
        on_confirm_delete: (user_id: string) => void
        on_cancel_delete: () => void
    } = $props();
</script>

<div class="row-actions">
    {#if confirm_delete === user.id}
        <span class="confirm-text">Are you sure?</span>
        <Button variant="danger" size="sm" onclick={() => on_delete(user.id)} disabled={deleting.has(user.id)}>
            {deleting.has(user.id) ? 'Deleting...' : 'Confirm'}
        </Button>
        <Button variant="secondary" size="sm" onclick={on_cancel_delete}>Cancel</Button>
    {:else}
        <Button
            variant="secondary"
            size="sm"
            onclick={() => on_toggle_role(user)}
            disabled={role_toggling.has(user.id) || user.id === self_id || (user.role === 'admin' && admin_count <= 1)}
            title={user.id === self_id
                ? 'Cannot change your own role'
                : user.role === 'admin' && admin_count <= 1
                    ? 'Cannot demote last admin'
                    : ''}
        >
            {role_toggling.has(user.id) ? '...' : user.role === 'admin' ? 'Make User' : 'Make Admin'}
        </Button>
        <Button
            variant="danger"
            size="sm"
            onclick={() => on_confirm_delete(user.id)}
            disabled={user.id === self_id}
            title={user.id === self_id ? 'Cannot revoke your own access' : ''}
        >
            Revoke Access
        </Button>
    {/if}
</div>

<style>
    .row-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .confirm-text {
        font-size: 0.8rem;
        color: var(--fg-muted);
    }
    @media (max-width: 768px) {
        .row-actions { flex-wrap: wrap; }
    }
</style>

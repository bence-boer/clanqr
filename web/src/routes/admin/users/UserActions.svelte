<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { User } from '$lib/types';

    let {
        user,
        self_id,
        admin_count,
        role_toggling,
        on_toggle_role,
        on_delete
    }: {
        user: User
        self_id: string | null
        admin_count: number
        role_toggling: Set<string>
        on_toggle_role: (user: User) => void
        on_delete: (user: User) => void
    } = $props();
</script>

<div class="row-actions">
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
        onclick={() => on_delete(user)}
        disabled={user.id === self_id}
        title={user.id === self_id ? 'Cannot revoke your own access' : ''}
    >
        Revoke Access
    </Button>
</div>

<style>
    .row-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    @media (max-width: 768px) {
        .row-actions { flex-wrap: wrap; }
    }
</style>

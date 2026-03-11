<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { api } from '$lib/api/client';
    import { LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { auth_store } from '$lib/stores/auth.svelte';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { InviteToken, User } from '$lib/types';
    import { onMount } from 'svelte';
    import InviteForm from './InviteForm.svelte';
    import InviteTable from './InviteTable.svelte';
    import UserTable from './UserTable.svelte';

    // ── Auth ────────────────────────────────────────────────────────────────────
    let self_id = $derived(auth_store.passkey_id);
    let role_checked = $state(false);

    // Redirect non-admin users
    $effect(() => {
        if (auth_store.role !== null) {
            if (auth_store.role !== 'admin') {
                toast_store.error('Admin access required');
                goto(resolve('/'));
            }
            else {
                role_checked = true;
            }
        }
    });

    // ── Tabs ────────────────────────────────────────────────────────────────────
    let active_tab: 'users' | 'invites' = $state('users');

    // ── Users tab ───────────────────────────────────────────────────────────────
    let users: User[] = $state([]);
    let users_loading = $state(true);
    let users_error = $state('');

    let admin_count = $derived(users.filter((u) => u.role === 'admin').length);

    async function load_users() {
        users_loading = true;
        users_error = '';
        try {
            users = await api.list_users();
        }
        catch (err: unknown) {
            toast_store.error(err instanceof Error ? err.message : 'Failed to create invite');
        }
        finally {
            users_loading = false;
        }
    }

    async function toggle_role(user: User) {
        const new_role = user.role === 'admin' ? 'user' : 'admin';
        const prev_role = user.role;

        // Optimistic update
        users = users.map((u) => (u.id === user.id ? { ...u, role: new_role } : u));

        try {
            await api.update_user_role(user.id, new_role);
        }
        catch (err: unknown) {
            // Rollback
            users = users.map((u) => (u.id === user.id ? { ...u, role: prev_role } : u));
            users_error = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }

    async function delete_user(user_id: string) {
        try {
            await api.delete_user(user_id);
            users = users.filter((u) => u.id !== user_id);
        }
        catch (err: unknown) {
            users_error = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }

    // ── Invites tab ─────────────────────────────────────────────────────────────
    let invites: InviteToken[] = $state([]);
    let invites_loading = $state(true);

    async function load_invites() {
        invites_loading = true;
        try {
            invites = await api.list_invites();
        }
        catch {
            // Errors handled by subcomponents
        }
        finally {
            invites_loading = false;
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────
    onMount(() => {
        load_users();
        load_invites();
    });
</script>

<div class="page">
    {#if !role_checked}
        <LoadingSpinner label="Checking permissions…" />
    {:else}
        <div class="page-header">
            <h2>Admin</h2>
        </div>

        <div class="tabs">
            <Button variant="tab" active={active_tab === 'users'} icon="group" onclick={() => (active_tab = 'users')}>Users</Button>
            <Button variant="tab" active={active_tab === 'invites'} icon="link" onclick={() => (active_tab = 'invites')}>Invite Links</Button>
        </div>

        {#if active_tab === 'users'}
            <UserTable {users} {users_loading} {users_error} {self_id} {admin_count} ontoggle_role={toggle_role} ondelete_user={(user_id) => delete_user(user_id)} />
        {/if}

        {#if active_tab === 'invites'}
            <div class="tab-content">
                <InviteForm oninvite_created={load_invites} />
                <InviteTable bind:invites {invites_loading} />
            </div>
        {/if}
    {/if}
</div>

<style>
    .page {
        max-width: 1000px;
        overflow-x: hidden;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }

    /* Tabs */
    .tabs {
        box-sizing: border-box;
        display: flex;
        gap: 0.25rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    /* Mobile */
    @media (max-width: 768px) {
        .tabs {
            overflow-x: auto;
        }
    }
</style>

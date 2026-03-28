<script lang="ts">
    import { api } from '$lib/api/client';
    import { auth_store } from '$lib/stores/auth.svelte';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { User } from '$lib/types';
    import { onMount } from 'svelte';
    import UserTable from './UserTable.svelte';

    let self_id = $derived(auth_store.passkey_id);

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
            toast_store.error(err instanceof Error ? err.message : 'Failed to load users');
            users_error = err instanceof Error ? err.message : 'Failed to load users';
        }
        finally {
            users_loading = false;
        }
    }

    async function toggle_role(user: User) {
        const new_role = user.role === 'admin' ? 'member' : 'admin';
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

    onMount(() => {
        load_users();
    });
</script>

<UserTable {users} {users_loading} {users_error} {self_id} {admin_count} ontoggle_role={toggle_role} ondelete_user={(user_id) => delete_user(user_id)} />

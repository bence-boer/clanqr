<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { LoadingSpinner, Tabs, type TabItem } from '$lib/components';
    import { auth_store } from '$lib/stores/auth.svelte';
    import { toast_store } from '$lib/stores/toast.svelte';

    let { children } = $props();

    let role_checked = $state(false);

    type AdminRoute = 'users' | 'metrics' | 'maintenance' | 'settings';
    const tabs = [
        { label: 'Users', icon: 'group', value: 'users' },
        { label: 'Metrics', icon: 'monitoring', value: 'metrics' },
        { label: 'Settings', icon: 'tune', value: 'settings' },
        { label: 'Maintenance', icon: 'build', value: 'maintenance' }
    ] as const satisfies TabItem<AdminRoute>[];

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

    const PATH_BY_ROUTE_ID: Partial<Record<Exclude<typeof page.route.id, null>, AdminRoute>> = {
        '/admin/users': 'users',
        '/admin/metrics': 'metrics',
        '/admin/maintenance': 'maintenance',
        '/admin/settings': 'settings'
    };

    let active_tab = $derived(PATH_BY_ROUTE_ID[page.route.id ?? '/admin/users'] ?? 'users');

    function handle_tab_change(new_tab: AdminRoute) {
        goto(resolve(`/admin/${new_tab}`));
    }
</script>

<div class="page">
    {#if !role_checked}
        <LoadingSpinner label="Checking permissions…" />
    {:else}
        <div class="page-header">
            <h2>Admin</h2>
        </div>

        <Tabs
            items={tabs}
            value={active_tab}
            on_tab_select={(tab) => {
                if (tab !== active_tab) {
                    handle_tab_change(tab);
                }
            }}
        />

        <div class="tab-content">
            {@render children?.()}
        </div>
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

    .tab-content {
        margin-top: 1.5rem;
    }

    /* Mobile */
    @media (max-width: 768px) {
        :global(.tabs) {
            overflow-x: auto;
        }
    }
</style>

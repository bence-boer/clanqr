<script lang="ts">
    import { page } from '$app/state';
    import { api } from '$lib/api/client';
    import { Toast } from '$lib/components';
    import { auth_store } from '$lib/stores/auth.svelte';
    import { toast_store } from '$lib/stores/toast.svelte';
    import '$lib/styles/global.css';
    import type { SystemAlert, SystemStats } from '$lib/types';
    import { onMount } from 'svelte';
    import AuthScreen from './AuthScreen.svelte';
    import Sidebar from './Sidebar.svelte';

    let { children } = $props();

    let sidebar_open: boolean = $state(false);
    let system_stats: SystemStats | null = $state(null);
    let critical_alerts: SystemAlert[] = $state([]);
    let current_path = $derived(page.url.pathname);

    let auth_check_done = $state(false);

    async function do_auth_check() {
        if (auth_check_done) return;
        auth_check_done = true;
        await auth_store.check();
        if (auth_store.state === 'authenticated') {
            load_system_stats();
        }
    }

    onMount(() => {
        if (!current_path.startsWith('/invite')) {
            do_auth_check();
        }
    });

    // Re-check auth when navigating away from invite pages
    $effect(() => {
        if (!current_path.startsWith('/invite') && !auth_check_done) {
            do_auth_check();
        }
    });

    async function load_system_stats() {
        try {
            const [stats, alerts_resp] = await Promise.all([api.system_stats(), api.system_alerts().catch(() => ({ alerts: [] }))]);
            system_stats = stats;
            critical_alerts = alerts_resp.alerts.filter((a: SystemAlert) => a.severity === 'critical');
        } catch (err) {
            toast_store.error('Failed to load system stats');
        }
    }

    async function handle_register(name: string) {
        await auth_store.register(name);
    }

    async function handle_login() {
        await auth_store.login();
    }

    async function handle_logout() {
        await auth_store.sign_out();
    }

    function close_sidebar() {
        sidebar_open = false;
    }
</script>

<svelte:head>
    <title>Ralph Agent Workspace</title>
</svelte:head>

{#if current_path.startsWith('/invite')}
    {@render children()}
{:else if auth_store.state !== 'authenticated'}
    <AuthScreen auth_state={auth_store.state} error={auth_store.error} pending={auth_store.pending} onregister={handle_register} onlogin={handle_login} />
{:else}
    <div class="app" class:sidebar-open={sidebar_open}>
        <button class="mobile-toggle" onclick={() => (sidebar_open = !sidebar_open)}>
            <span class="icon">{sidebar_open ? 'close' : 'menu'}</span>
        </button>

        {#if sidebar_open}
            <button class="sidebar-overlay" onclick={close_sidebar} aria-label="Close sidebar"></button>
        {/if}

        <Sidebar {current_path} role={auth_store.role} {system_stats} {sidebar_open} onclose={close_sidebar} onlogout={handle_logout} />
        <main class="content">
            {#if critical_alerts.length > 0}
                <div class="critical-banner" role="alert">
                    <span class="icon" style="font-size:16px">error</span>
                    {critical_alerts.map((a) => a.message).join(' · ')}
                </div>
            {/if}
            {@render children()}
        </main>
    </div>
    <Toast />
{/if}

<style>
    .app {
        display: flex;
        min-height: 100vh;
    }

    .mobile-toggle {
        display: none;
        position: fixed;
        top: 0.75rem;
        left: 0.75rem;
        z-index: 60;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        padding: 0.5rem;
        cursor: pointer;
        line-height: 1;
    }

    .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 39;
        border: none;
        cursor: pointer;
        font-size: 0;
    }

    .content {
        flex: 1;
        margin-left: 220px;
        padding: 2rem;
        max-width: 1200px;
        overflow: hidden;
    }

    .critical-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        margin-bottom: 1rem;
        background: rgba(201, 84, 74, 0.12);
        color: var(--danger);
        border: 1px solid rgba(201, 84, 74, 0.3);
        border-radius: var(--radius);
        font-size: 0.8rem;
        font-weight: 600;
    }

    @media (max-width: 768px) {
        .mobile-toggle {
            display: flex;
            transition: left 0.2s ease;
        }

        .sidebar-open .mobile-toggle {
            left: calc(220px + 0.75rem);
        }

        :global(.sidebar-open .sidebar) {
            transform: translateX(0);
        }

        .sidebar-open .sidebar-overlay {
            display: block;
        }

        .content {
            margin-left: 0;
            padding: 1rem;
            padding-top: 3.5rem;
        }
    }
</style>

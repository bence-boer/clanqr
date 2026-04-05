<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { SystemStats } from '$lib/types';
    import SidebarNav from './SidebarNav.svelte';

    import type { Snippet } from 'svelte';

    interface SidebarBadges {
        pending_approval_count?: number
        failed_agent_count?: number
        pipeline_paused?: boolean
        active_invite_count?: number
    }

    let {
        current_path,
        role = null,
        system_stats = null,
        collapsed = false,
        badges = {},
        notification_bell,
        on_close,
        on_logout,
        on_toggle_collapse
    }: {
        current_path: string
        role?: string | null
        system_stats?: SystemStats | null
        sidebar_open: boolean
        collapsed?: boolean
        badges?: SidebarBadges
        notification_bell?: Snippet
        on_close: () => void
        on_logout: () => void
        on_toggle_collapse?: () => void
    } = $props();
</script>

<nav class="sidebar" class:collapsed aria-label="Main navigation">
    <div class="logo">
        <span class="icon logo-icon">smart_toy</span>
        <div>
            <h1>Clanqr</h1>
            <span class="subtitle">Agent Workspace</span>
        </div>
        {#if notification_bell}
            <div class="bell-slot">
                {@render notification_bell()}
            </div>
        {/if}
    </div>

    <SidebarNav {current_path} {role} {badges} {on_close} />

    <div class="sidebar-footer">
        {#if system_stats}
            <div class="system-mini-stats">
                <span class="icon" style="font-size:14px">memory</span>
                CPU {system_stats.cpu_percent}%
                {#if system_stats.cpu_temp_celsius !== null}
                    · {system_stats.cpu_temp_celsius}°C
                {/if}
            </div>
        {/if}
        <span class="shortcut-hint">⌘K to search</span>
        <Button variant="ghost" style="width: 100%; justify-content: flex-start;" icon="logout" onclick={on_logout}>
            <span>Sign out</span>
        </Button>
        {#if on_toggle_collapse}
            <button class="collapse-toggle" onclick={on_toggle_collapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                <span class="icon">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>
        {/if}
    </div>
</nav>

<style>
    .sidebar {
        width: 220px;
        background: var(--bg-surface);
        border-right: 1px solid var(--border);
        padding: 1.5rem 0.75rem;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        z-index: 40;
        transition: width 0.2s ease;
    }

    .sidebar.collapsed {
        width: 48px;
    }

    .sidebar.collapsed :global(.nav-section-label),
    .sidebar.collapsed .logo > div,
    .sidebar.collapsed :global(.nav-links a span:not(.icon)),
    .sidebar.collapsed :global(.nav-links a .nav-badge),
    .sidebar.collapsed .sidebar-footer .system-mini-stats,
    .sidebar.collapsed .sidebar-footer .shortcut-hint,
    .sidebar.collapsed .sidebar-footer :global(button span:not(.icon)) {
        display: none;
    }

    .sidebar.collapsed :global(.nav-links a) {
        justify-content: center;
        padding: 0.55rem;
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0 0.5rem;
        margin-bottom: 1.5rem;
    }

    .logo-icon {
        font-size: 28px;
        color: var(--accent);
    }

    .logo h1 {
        font-size: 1.2rem;
        color: var(--fg);
        line-height: 1.2;
    }

    .subtitle {
        font-size: 0.65rem;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .bell-slot {
        margin-left: auto;
    }

    .sidebar-footer {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
    }

    .system-mini-stats {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        font-size: 0.75rem;
        color: var(--fg-muted);
        margin-bottom: 0.25rem;
    }

    .shortcut-hint {
        display: block;
        font-size: 0.7rem;
        color: var(--fg-muted);
        opacity: 0.5;
        padding: 0.25rem 0.75rem;
        text-align: center;
    }

    .collapse-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 0.4rem;
        margin-top: 0.25rem;
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg-muted);
        cursor: pointer;
        transition: all 0.15s;
    }

    .collapse-toggle:hover {
        background: var(--bg-elevated);
        color: var(--fg);
    }

    @media (max-width: 768px) {
        .sidebar {
            transform: translateX(-100%);
            transition: transform 0.2s ease, width 0.2s ease;
        }

        .collapse-toggle {
            display: none;
        }
    }
</style>

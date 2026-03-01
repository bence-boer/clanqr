<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { SystemStats } from '$lib/types';
    import SidebarNav from './SidebarNav.svelte';

    let {
        current_path,
        role = null,
        system_stats = null,
        onclose,
        onlogout
    }: {
        current_path: string
        role?: string | null
        system_stats?: SystemStats | null
        sidebar_open: boolean
        onclose: () => void
        onlogout: () => void
    } = $props();
</script>

<nav class="sidebar">
    <div class="logo">
        <span class="icon logo-icon">smart_toy</span>
        <div>
            <h1>Ralph</h1>
            <span class="subtitle">Agent Workspace</span>
        </div>
    </div>

    <SidebarNav {current_path} {role} {onclose} />

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
        <Button variant="ghost" style="width: 100%; justify-content: flex-start;" icon="logout" onclick={onlogout}>Sign out</Button>
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

    @media (max-width: 768px) {
        .sidebar {
            transform: translateX(-100%);
            transition: transform 0.2s ease;
        }
    }
</style>

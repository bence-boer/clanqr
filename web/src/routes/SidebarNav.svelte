<script lang="ts">
    import { resolve } from '$app/paths';

    interface SidebarBadges {
        pending_approval_count?: number
        failed_agent_count?: number
        pipeline_paused?: boolean
        active_invite_count?: number
    }

    let {
        current_path,
        role = null,
        badges = {},
        on_close
    }: {
        current_path: string
        role?: string | null
        badges?: SidebarBadges
        on_close: () => void
    } = $props();

    function is_active(path: string) {
        if (path === '/') return current_path === '/';
        return current_path.startsWith(path);
    }
</script>

<div class="nav-section">
    <span class="nav-section-label">Workspace</span>
    <ul class="nav-links">
        <li>
            <a href={resolve('/')} onclick={on_close} class:active={is_active('/') && current_path === '/'}>
                <span class="icon">dashboard</span>
                <span>Dashboard</span>
            </a>
        </li>
        <li>
            <a href={resolve('/projects')} onclick={on_close} class:active={is_active('/projects')}>
                <span class="icon">folder</span>
                <span>Projects</span>
                {#if badges.pending_approval_count && badges.pending_approval_count > 0}
                    <span class="nav-badge warning">{badges.pending_approval_count}</span>
                {/if}
            </a>
        </li>
        <li>
            <a href={resolve('/pipeline')} onclick={on_close} class:active={is_active('/pipeline')}>
                <span class="icon">account_tree</span>
                <span>Pipeline</span>
                {#if badges.pipeline_paused}
                    <span class="nav-badge muted">Paused</span>
                {/if}
            </a>
        </li>
        <li>
            <a href={resolve('/monitoring')} onclick={on_close} class:active={is_active('/monitoring')}>
                <span class="icon">monitoring</span>
                <span>Monitoring</span>
                {#if badges.failed_agent_count && badges.failed_agent_count > 0}
                    <span class="nav-badge">{badges.failed_agent_count}</span>
                {/if}
            </a>
        </li>
    </ul>
</div>

<div class="nav-section">
    <span class="nav-section-label">Intelligence</span>
    <ul class="nav-links">
        <li>
            <a href={resolve('/chat')} onclick={on_close} class:active={is_active('/chat')}>
                <span class="icon">chat</span>
                <span>Chat</span>
            </a>
        </li>
        <li>
            <a href={resolve('/prompts')} onclick={on_close} class:active={is_active('/prompts')}>
                <span class="icon">tune</span>
                <span>Prompts &amp; Traits</span>
            </a>
        </li>
        <li>
            <a href={resolve('/skills')} onclick={on_close} class:active={is_active('/skills')}>
                <span class="icon">extension</span>
                <span>Skills</span>
            </a>
        </li>
    </ul>
</div>

<div class="nav-section">
    <span class="nav-section-label">Insights</span>
    <ul class="nav-links">
        <li>
            <a href={resolve('/usage')} onclick={on_close} class:active={is_active('/usage')}>
                <span class="icon">analytics</span>
                <span>Usage</span>
            </a>
        </li>
    </ul>
</div>

{#if role === 'admin'}
    <div class="nav-section">
        <span class="nav-section-label">Settings</span>
        <ul class="nav-links">
            <li>
                <a href={resolve('/admin')} onclick={on_close} class:active={is_active('/admin')}>
                    <span class="icon">admin_panel_settings</span>
                    <span>Admin</span>
                    {#if badges.active_invite_count && badges.active_invite_count > 0}
                        <span class="nav-badge">{badges.active_invite_count}</span>
                    {/if}
                </a>
            </li>
        </ul>
    </div>
{/if}

<style>
    .nav-links {
        list-style: none;
    }
    .nav-links li {
        margin-bottom: 0.15rem;
    }
    .nav-links a {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.75rem;
        color: var(--fg-muted);
        text-decoration: none;
        border-radius: var(--radius);
        font-size: 0.875rem;
        transition: all 0.15s;
        border-left: 2px solid transparent;
    }
    .nav-links a:hover {
        background: var(--bg-elevated);
        color: var(--fg);
    }
    .nav-links a.active {
        background: var(--bg);
        color: var(--accent);
        border-left-color: var(--accent);
    }
    .nav-section {
        margin-bottom: 1rem;
    }
    .nav-section-label {
        display: block;
        font-size: 0.65rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 0 0.75rem;
        margin-bottom: 0.25rem;
    }
    .nav-badge {
        margin-left: auto;
        background: var(--danger);
        color: var(--fg);
        font-size: 0.65rem;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
    }
    .nav-badge.warning {
        background: var(--accent);
        color: var(--bg);
    }
    .nav-badge.muted {
        background: var(--bg-elevated);
        color: var(--fg-muted);
    }
</style>

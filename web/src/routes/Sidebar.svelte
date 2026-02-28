<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { SystemStats } from '$lib/types';

    let {
        current_path,
        role = null,
        system_stats = null,
        sidebar_open,
        onclose,
        onlogout
    }: {
        current_path: string;
        role?: string | null;
        system_stats?: SystemStats | null;
        sidebar_open: boolean;
        onclose: () => void;
        onlogout: () => void;
    } = $props();

    function is_active(path: string) {
        if (path === '/') return current_path === '/';
        return current_path.startsWith(path);
    }
</script>

<nav class="sidebar">
    <div class="logo">
        <span class="icon logo-icon">smart_toy</span>
        <div>
            <h1>Ralph</h1>
            <span class="subtitle">Agent Workspace</span>
        </div>
    </div>

    <div class="nav-section">
        <span class="nav-section-label">Workspace</span>
        <ul class="nav-links">
            <li>
                <a href="/" onclick={onclose} class:active={is_active('/') && current_path === '/'}>
                    <span class="icon">dashboard</span>
                    Dashboard
                </a>
            </li>
            <li>
                <a href="/projects" onclick={onclose} class:active={is_active('/projects')}>
                    <span class="icon">folder</span>
                    Projects
                </a>
            </li>
            <li>
                <a href="/pipeline" onclick={onclose} class:active={is_active('/pipeline')}>
                    <span class="icon">account_tree</span>
                    Pipeline
                </a>
            </li>
            <li>
                <a href="/monitoring" onclick={onclose} class:active={is_active('/monitoring')}>
                    <span class="icon">monitoring</span>
                    Monitoring
                </a>
            </li>
        </ul>
    </div>

    <div class="nav-section">
        <span class="nav-section-label">AI</span>
        <ul class="nav-links">
            <li>
                <a href="/chat" onclick={onclose} class:active={is_active('/chat')}>
                    <span class="icon">chat</span>
                    Chat
                </a>
            </li>
            <li>
                <a href="/usage" onclick={onclose} class:active={is_active('/usage')}>
                    <span class="icon">analytics</span>
                    Usage
                </a>
            </li>
        </ul>
    </div>

    <div class="nav-section">
        <span class="nav-section-label">Configure</span>
        <ul class="nav-links">
            <li>
                <a href="/prompts" onclick={onclose} class:active={is_active('/prompts')}>
                    <span class="icon">tune</span>
                    Prompts &amp; Traits
                </a>
            </li>
            <li>
                <a href="/skills" onclick={onclose} class:active={is_active('/skills')}>
                    <span class="icon">extension</span>
                    Skills
                </a>
            </li>
        </ul>
    </div>

    {#if role === 'admin'}
        <div class="nav-section">
            <span class="nav-section-label">Settings</span>
            <ul class="nav-links">
                <li>
                    <a href="/admin" onclick={onclose} class:active={is_active('/admin')}>
                        <span class="icon">admin_panel_settings</span>
                        Admin
                    </a>
                </li>
            </ul>
        </div>
    {/if}

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

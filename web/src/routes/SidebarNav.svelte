<script lang="ts">
    import { resolve } from '$app/paths';

    let {
        current_path,
        role = null,
        onclose
    }: {
        current_path: string
        role?: string | null
        onclose: () => void
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
            <a href={resolve('/')} onclick={onclose} class:active={is_active('/') && current_path === '/'}>
                <span class="icon">dashboard</span>
                Dashboard
            </a>
        </li>
        <li>
            <a href={resolve('/projects')} onclick={onclose} class:active={is_active('/projects')}>
                <span class="icon">folder</span>
                Projects
            </a>
        </li>
        <li>
            <a href={resolve('/pipeline')} onclick={onclose} class:active={is_active('/pipeline')}>
                <span class="icon">account_tree</span>
                Pipeline
            </a>
        </li>
        <li>
            <a href={resolve('/monitoring')} onclick={onclose} class:active={is_active('/monitoring')}>
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
            <a href={resolve('/chat')} onclick={onclose} class:active={is_active('/chat')}>
                <span class="icon">chat</span>
                Chat
            </a>
        </li>
        <li>
            <a href={resolve('/usage')} onclick={onclose} class:active={is_active('/usage')}>
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
            <a href={resolve('/prompts')} onclick={onclose} class:active={is_active('/prompts')}>
                <span class="icon">tune</span>
                Prompts &amp; Traits
            </a>
        </li>
        <li>
            <a href={resolve('/skills')} onclick={onclose} class:active={is_active('/skills')}>
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
                <a href={resolve('/admin')} onclick={onclose} class:active={is_active('/admin')}>
                    <span class="icon">admin_panel_settings</span>
                    Admin
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
</style>

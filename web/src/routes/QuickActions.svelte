<script lang="ts">
    import { resolve } from '$app/paths';
</script>

<section class="section">
    <h3>Quick Actions</h3>
    <div class="quick-actions">
        <a href={resolve('/projects')} class="action-card">
            <span class="icon action-icon">add</span>
            <span>New Project</span>
        </a>
        <a href={resolve('/chat')} class="action-card">
            <span class="icon action-icon">chat</span>
            <span>Open Chat</span>
        </a>
        <a href={resolve('/pipeline')} class="action-card">
            <span class="icon action-icon">account_tree</span>
            <span>View Pipeline</span>
        </a>
        <a href={resolve('/prompts')} class="action-card">
            <span class="icon action-icon">tune</span>
            <span>Manage Prompts</span>
        </a>
    </div>
</section>

<style>
    .section {
        margin-bottom: 2rem;
    }
    .section h3 {
        font-size: 1.05rem;
        color: var(--fg);
        margin: 0 0 1rem;
    }
    .quick-actions {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
    }
    .action-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem;
        text-decoration: none;
        color: var(--fg-muted);
        font-size: 0.8rem;
        transition: all 0.15s;
    }
    .action-card:hover {
        background: var(--bg-elevated);
        color: var(--fg);
        border-color: var(--accent);
    }
    .action-icon {
        font-size: 22px;
        color: var(--accent);
    }
    @media (max-width: 768px) {
        .quick-actions {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>

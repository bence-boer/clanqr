<script lang="ts">
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import { Button } from '$lib/components/primitives';
</script>

<div class="error-page">
    <div class="error-card">
        <span class="icon large">error</span>
        <h1>Something went wrong</h1>
        <p class="error-subtitle">
            {#if page.status === 404}
                The page you're looking for doesn't exist.
            {:else if page.status === 403}
                You don't have permission to view this page.
            {:else if page.status >= 500}
                A server error occurred. Please try again later.
            {:else}
                An unexpected error occurred. Please try again.
            {/if}
        </p>
        {#if page.error?.message}
            <p class="error-detail">{page.error.message}</p>
        {/if}
        <div class="error-actions">
            <a href={resolve('/')} style="text-decoration:none">
                <Button variant="primary" icon="home">Go Home</Button>
            </a>
            <Button variant="default" onclick={() => window.location.reload()}>
                <span class="icon">refresh</span>
                Retry
            </Button>
        </div>
    </div>
</div>

<style>
    .error-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
    }

    .error-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 2.5rem;
        text-align: center;
        max-width: 420px;
        width: 100%;
    }

    .error-card h1 {
        font-size: 1.5rem;
        color: var(--fg);
        margin-bottom: 0.5rem;
    }

    .icon.large {
        font-size: 48px;
        color: var(--danger);
        margin-bottom: 1rem;
    }

    .error-subtitle {
        color: var(--fg-muted);
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }

    .error-detail {
        color: var(--fg-muted);
        font-size: 0.8rem;
        background: var(--bg);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        margin-bottom: 1.5rem;
        font-family: var(--font-mono);
    }

    .error-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
    }
</style>

<script lang="ts">
    import { admin_api } from '$lib/api/admin-client';
    import { Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';

    let cleanup_loading = $state(false);

    async function cleanup_workspaces() {
        cleanup_loading = true;
        try {
            const data = await admin_api.cleanup_workspaces();
            toast_store.success(`Cleaned up ${data.cleaned} workspace(s)`);
        }
        catch (error) {
            console.error(error);
            toast_store.error('Workspace cleanup failed');
        }
        finally {
            cleanup_loading = false;
        }
    }
</script>

<div class="maintenance-section">
    <h4 class="section-heading">Workspace Cleanup</h4>
    <p class="maintenance-desc">Remove agent workspaces older than 7 days to free disk space.</p>
    <Button variant="danger" icon="delete_sweep" onclick={cleanup_workspaces} disabled={cleanup_loading}>
        {cleanup_loading ? 'Cleaning…' : 'Clean Up Workspaces'}
    </Button>
</div>

<style>
    .maintenance-section {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
    }
    .section-heading {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin: 0 0 0.5rem;
    }
    .maintenance-desc {
        color: var(--fg-muted);
        font-size: 0.85rem;
        margin-bottom: 1rem;
    }
</style>

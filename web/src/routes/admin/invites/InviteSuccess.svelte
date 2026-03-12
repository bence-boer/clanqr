<script lang="ts">
    import { Button } from '$lib/components/primitives';

    let {
        new_invite_url = $bindable(),
        copy_done,
        on_copy,
        on_dismiss
    }: {
        new_invite_url: string | null
        copy_done: boolean
        on_copy: () => void
        on_dismiss: () => void
    } = $props();
</script>

{#if new_invite_url}
    <div class="invite-success">
        <div class="invite-success-header">
            <span class="icon" style="color:var(--success)">check_circle</span>
            <strong>Invite link created</strong>
            <Button variant="secondary" size="sm" onclick={on_dismiss}>
                <span class="icon" style="font-size:14px">close</span>
            </Button>
        </div>
        <div class="invite-url-row">
            <code class="invite-url">{new_invite_url}</code>
            <Button variant="secondary" size="sm" onclick={on_copy}>
                <span class="icon" style="font-size:14px">{copy_done ? 'check' : 'content_copy'}</span>
                {copy_done ? 'Copied!' : 'Copy Link'}
            </Button>
        </div>
        <p class="invite-warning">
            <span class="icon" style="font-size:16px;color:var(--danger)">warning</span>
            <strong>Copy this link now!</strong> It will not be shown again after you dismiss this message.
        </p>
    </div>
{/if}

<style>
    .invite-success {
        background: rgba(74, 158, 110, 0.08);
        border: 1px solid rgba(74, 158, 110, 0.3);
        border-radius: var(--radius);
        padding: 1rem;
        margin-bottom: 1.5rem;
    }
    .invite-success-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }
    .invite-success-header strong { flex: 1; color: var(--fg); }
    .invite-url-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
    }
    .invite-url {
        flex: 1;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 0.75rem;
        color: var(--fg);
        background: var(--bg-elevated);
        padding: 0.4rem 0.6rem;
        border-radius: 4px;
        word-break: break-all;
        min-width: 0;
    }
    .invite-warning {
        font-size: 0.82rem;
        color: var(--danger);
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-radius: var(--radius);
        padding: 0.5rem 0.75rem;
        margin-top: 0.25rem;
    }
    @media (max-width: 768px) {
        .invite-url-row { flex-direction: column; align-items: flex-start; }
        .invite-url { width: 100%; }
    }
</style>

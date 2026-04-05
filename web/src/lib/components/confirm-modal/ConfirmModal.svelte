<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { Snippet } from 'svelte';

    interface Props {
        open: boolean
        title: string
        message?: string
        confirm_label?: string
        cancel_label?: string
        variant?: 'danger' | 'warning' | 'default'
        loading?: boolean
        on_confirm: () => void
        on_cancel: () => void
        children?: Snippet
    }

    let {
        open = $bindable(false),
        title,
        message,
        confirm_label = 'Confirm',
        cancel_label = 'Cancel',
        variant = 'default',
        loading = false,
        on_confirm,
        on_cancel,
        children
    }: Props = $props();

    let dialog_ref: HTMLDialogElement | null = $state(null);

    const modal_id = crypto.randomUUID().slice(0, 8);

    $effect(() => {
        if (!dialog_ref) return;
        if (open && !dialog_ref.open) {
            dialog_ref.showModal();
        }
        else if (!open && dialog_ref.open) {
            dialog_ref.close();
        }
    });

    function handle_backdrop_click(e: MouseEvent) {
        if (e.target === dialog_ref) {
            on_cancel();
        }
    }

    function handle_cancel(e: Event) {
        e.preventDefault();
        on_cancel();
    }

    function handle_keydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !loading) {
            e.preventDefault();
            on_confirm();
        }
    }
</script>

<dialog
    bind:this={dialog_ref}
    data-slot="confirm-modal"
    class="confirm-modal"
    class:variant-danger={variant === 'danger'}
    class:variant-warning={variant === 'warning'}
    onclick={handle_backdrop_click}
    oncancel={handle_cancel}
    onkeydown={handle_keydown}
    aria-labelledby="confirm-title-{modal_id}"
>
    <div class="modal-content" role="presentation" onclick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title-{modal_id}" class="modal-title">{title}</h3>
        {#if message}
            <p class="modal-message">{message}</p>
        {/if}
        {#if children}
            <div class="modal-body">
                {@render children()}
            </div>
        {/if}
        <div class="modal-actions">
            <Button variant="ghost" onclick={on_cancel} disabled={loading}>
                {cancel_label}
            </Button>
            <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                onclick={on_confirm}
                {loading}
            >
                {confirm_label}
            </Button>
        </div>
    </div>
</dialog>

<style>
    .confirm-modal {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        padding: 0;
        max-width: min(440px, calc(100vw - 2rem));
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .confirm-modal::backdrop {
        background: rgba(0, 0, 0, 0.6);
        /* backdrop uses literal black — intentional */
    }

    .confirm-modal[open] {
        animation: modal-in 200ms ease;
    }

    @keyframes modal-in {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .modal-content {
        padding: 1.5rem;
    }

    .modal-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        color: var(--fg);
    }

    .variant-danger .modal-title {
        color: var(--danger);
    }

    .variant-warning .modal-title {
        color: var(--accent);
    }

    .modal-message {
        font-size: 0.875rem;
        color: var(--fg-muted);
        line-height: 1.5;
        margin-bottom: 1.25rem;
    }

    .modal-body {
        margin-bottom: 1.25rem;
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }
</style>

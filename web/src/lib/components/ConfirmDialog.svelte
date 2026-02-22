<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message: string;
    confirm_label?: string;
    cancel_label?: string;
    variant?: 'danger' | 'primary';
    on_confirm: () => void;
    on_cancel: () => void;
  }

  let {
    open,
    title = 'Confirm',
    message,
    confirm_label = 'Confirm',
    cancel_label = 'Cancel',
    variant = 'danger',
    on_confirm,
    on_cancel,
  }: Props = $props();
</script>

{#if open}
  <div class="dialog-overlay" role="presentation">
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
      <h3 id="dialog-title">{title}</h3>
      <p id="dialog-message">{message}</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-sm" onclick={on_cancel}>{cancel_label}</button>
        <button
          class="btn {variant === 'danger' ? 'btn-danger' : 'btn-primary'} btn-sm"
          onclick={on_confirm}
        >
          {confirm_label}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .dialog {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    max-width: 380px;
    width: 100%;
  }

  .dialog h3 {
    font-size: 1rem;
    color: var(--fg);
    margin-bottom: 0.5rem;
  }

  .dialog p {
    font-size: 0.875rem;
    color: var(--fg-muted);
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  /* Local button styles for the dialog */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
  }

  .btn-secondary {
    background: var(--bg-elevated);
    color: var(--fg);
    border: 1px solid var(--border);
  }

  .btn-danger {
    background: var(--danger);
    color: #fff;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
  }

  .btn-sm {
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
  }
</style>

<script lang="ts">
  interface Props {
    status: string;
  }

  const { status }: Props = $props();

  const icon_map: Record<string, string> = {
    draft: 'edit_note',
    submitted: 'send',
    in_progress: 'sync',
    done: 'check_circle',
    pending_approval: 'pending',
    approved: 'thumb_up',
    complete: 'check_circle',
    completed: 'check_circle',
    pending: 'hourglass_empty',
    queued: 'queue',
    running: 'sync',
    failed: 'error',
    stopped: 'stop_circle',
    fetched: 'check',
    error: 'error',
  };

  const class_map: Record<string, string> = {
    draft: 'muted',
    submitted: 'info',
    in_progress: 'warn',
    done: 'success',
    pending_approval: 'warn',
    approved: 'info',
    complete: 'success',
    completed: 'success',
    pending: 'muted',
    queued: 'muted',
    running: 'warn',
    failed: 'danger',
    stopped: 'muted',
    fetched: 'success',
    error: 'danger',
  };

  const key = $derived(status.toLowerCase());
  const icon = $derived(icon_map[key] ?? 'help');
  const cls = $derived(class_map[key] ?? 'muted');
  const label = $derived(status.replace(/_/g, ' '));
</script>

<span class="badge badge-{cls}">
  <span class="icon" style="font-size:11px">{icon}</span>
  {label}
</span>

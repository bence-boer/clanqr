<script lang="ts">
    import { Badge } from '$lib/components/primitives';
    import { status_class, status_icon } from '$lib/utils/status';

    interface Props {
        status: string;
    }

    const { status }: Props = $props();

    const icon = $derived(status_icon(status));
    const badge_variant = $derived(status_class(status));
    const label = $derived(status.replace(/_/g, ' '));
</script>

<Badge variant={badge_variant} {icon}>{label}</Badge>

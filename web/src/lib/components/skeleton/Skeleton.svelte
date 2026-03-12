<script lang="ts">
    type SkeletonVariant = 'card' | 'list-item' | 'table-row' | 'stat' | 'text' | 'circle';

    interface Props {
        variant?: SkeletonVariant
        width?: string
        height?: string
        count?: number
    }

    const { variant = 'text', width, height, count = 1 }: Props = $props();
</script>

{#each Array.from({ length: count }, (_, index) => index) as index (index)}
    <div
        class="skeleton skeleton-{variant}"
        style:width={width}
        style:height={height}
        aria-hidden="true"
    ></div>
{/each}

<style>
    .skeleton {
        background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: var(--radius);
    }

    .skeleton-text {
        height: 0.875rem;
        width: 100%;
        margin-bottom: 0.5rem;
        border-radius: 4px;
    }

    .skeleton-card {
        height: 120px;
        width: 100%;
    }

    .skeleton-list-item {
        height: 3rem;
        width: 100%;
        margin-bottom: 0.5rem;
    }

    .skeleton-table-row {
        height: 2.5rem;
        width: 100%;
        margin-bottom: 0.25rem;
    }

    .skeleton-stat {
        height: 5rem;
        width: 100%;
    }

    .skeleton-circle {
        height: 2.5rem;
        width: 2.5rem;
        border-radius: 50%;
    }

    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
</style>

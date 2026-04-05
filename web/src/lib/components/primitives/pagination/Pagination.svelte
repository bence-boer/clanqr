<script lang="ts">
    import { Button } from '../button';

    export interface PaginationProperties {
        current_page: number
        total_pages: number
        on_page_change: (page: number) => void
    }

    let { current_page, total_pages, on_page_change }: PaginationProperties = $props();
</script>

{#if total_pages > 1}
    <div class="pagination">
        <Button
            variant="secondary"
            size="sm"
            icon="chevron_left"
            disabled={current_page <= 1}
            onclick={() => on_page_change(current_page - 1)}
            aria-label="Previous page"
        />
        <span class="page-info">Page {current_page} of {total_pages}</span>
        <Button
            variant="secondary"
            size="sm"
            icon="chevron_right"
            disabled={current_page >= total_pages}
            onclick={() => on_page_change(current_page + 1)}
            aria-label="Next page"
        />
    </div>
{/if}

<style>
    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin-top: 1rem;
    }
    .page-info {
        font-size: 0.8rem;
        color: var(--fg-muted);
    }
    @media (max-width: 768px) {
        .pagination { flex-wrap: wrap; gap: 0.5rem; }
    }
</style>

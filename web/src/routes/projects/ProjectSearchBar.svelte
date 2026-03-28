<script lang="ts">
    import { Input } from '$lib/components/primitives';
    import type { ProjectStatus } from '$lib/types';

    type FilterStatus = 'All' | ProjectStatus;

    interface Props {
        search_query: string
        active_filter: FilterStatus
        filtered_count: number
        total_count: number
    }

    let {
        search_query = $bindable(),
        active_filter = $bindable(),
        filtered_count,
        total_count
    }: Props = $props();

    const filter_options: FilterStatus[] = ['All', 'active', 'archived'];
</script>

<div class="search-filter-bar">
    <div class="search-box">
        <span class="icon search-icon">search</span>
        <Input type="text" placeholder="Search projects…" bind:value={search_query} class="search-input" />
    </div>
    <div class="filter-pills">
        {#each filter_options as filter (filter)}
            <button
                class="filter-pill"
                class:active={active_filter === filter}
                onclick={() => (active_filter = filter)}
            >
                {filter}
            </button>
        {/each}
    </div>
</div>
<p class="result-count">Showing {filtered_count} of {total_count} projects</p>

<style>
    .search-filter-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
    }
    .search-box {
        position: relative;
        flex: 1;
        min-width: 200px;
    }
    .search-icon {
        position: absolute;
        left: 0.6rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 18px;
        color: var(--fg-muted);
        pointer-events: none;
    }
    :global(.search-input) {
        padding-left: 2.2rem !important;
    }
    .filter-pills {
        display: flex;
        gap: 0.35rem;
    }
    .filter-pill {
        padding: 0.3rem 0.75rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--fg-muted);
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s;
        font-family: var(--font);
    }
    .filter-pill:hover {
        border-color: var(--accent);
        color: var(--fg);
    }
    .filter-pill.active {
        background: var(--accent);
        color: var(--bg);
        border-color: var(--accent);
    }
    .result-count {
        font-size: 0.75rem;
        color: var(--fg-muted);
        margin-bottom: 1rem;
    }
</style>

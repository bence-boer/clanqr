<script lang="ts">
    import type { AgentProcess } from '$lib/types';
    import { Button, Input, Select } from '$lib/components/primitives';

    type StatusFilter = 'all' | 'running' | 'completed' | 'failed';
    type SortOption = 'newest' | 'oldest' | 'longest';

    let {
        agents,
        onchange
    }: {
        agents: AgentProcess[]
        onchange?: (filtered: AgentProcess[]) => void
    } = $props();

    let filter_status = $state<StatusFilter>('all');
    let sort_by = $state<SortOption>('newest');
    let search_query = $state('');

    const filter_options: { value: StatusFilter, label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'running', label: 'Running' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' }
    ];

    const computed_filtered = $derived.by(() => {
        let result = agents;

        if (filter_status !== 'all') {
            result = result.filter((a) => a.status === filter_status);
        }

        if (search_query.trim()) {
            const query = search_query.trim().toLowerCase();
            result = result.filter((a) =>
                a.id.toLowerCase().includes(query)
                || a.agent_type.toLowerCase().includes(query)
                || (a.task_id ?? '').toLowerCase().includes(query)
            );
        }

        return [...result].sort((a, b) => {
            if (sort_by === 'newest') {
                return new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime();
            }
            if (sort_by === 'oldest') {
                return new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime();
            }
            const a_running = a.status === 'running' ? 1 : 0;
            const b_running = b.status === 'running' ? 1 : 0;
            if (a_running !== b_running) return b_running - a_running;
            return new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime();
        });
    });

    $effect(() => {
        onchange?.(computed_filtered);
    });
</script>

<div class="toolbar">
    <div class="filter-pills" role="group" aria-label="Filter by status">
        {#each filter_options as option (option.value)}
            <Button
                variant="filter"
                size="sm"
                active={filter_status === option.value}
                onclick={() => filter_status = option.value}
            >
                {option.label}
            </Button>
        {/each}
    </div>

    <div class="toolbar-controls">
        <Input
            placeholder="Search agents..."
            bind:value={search_query}
            style="max-width: 220px"
            aria-label="Search agents"
        />

        <Select bind:value={sort_by} style="max-width: 180px">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest running</option>
        </Select>
    </div>
</div>

<style>
    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .filter-pills {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
    }
    .toolbar-controls {
        display: flex;
        gap: 0.5rem;
        align-items: flex-end;
        flex-wrap: wrap;
    }
    @media (max-width: 768px) {
        .toolbar { flex-direction: column; align-items: stretch; }
        .toolbar-controls { flex-direction: column; }
    }
</style>

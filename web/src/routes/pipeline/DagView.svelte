<script lang="ts">
    import { DagGraph, type DagEdge, type DagNode } from '$lib/components/dag-graph';
    import { AGENT_TYPE_VISUALS, type AgentTypeKey } from '$lib/components/agent-type-badge';

    let {
        nodes,
        edges,
        selected_id = null,
        on_node_click
    }: {
        nodes: DagNode[]
        edges: DagEdge[]
        selected_id?: string | null
        on_node_click?: (node_id: string) => void
    } = $props();

    let show_legend = $state(false);

    const legend_types = $derived.by(() => {
        const used = new Set(nodes.map((n) => n.agent_type));
        return Object.entries(AGENT_TYPE_VISUALS)
            .filter(([key]) => used.has(key))
            .map(([key, v]) => ({ key: key as AgentTypeKey, ...v }));
    });
</script>

<div class="dag-view">
    <div class="dag-toolbar">
        <span class="dag-title">
            <span class="icon" style="font-size:18px">account_tree</span>
            Task Graph
        </span>
        <button class="legend-toggle" onclick={() => {
            show_legend = !show_legend;
        }}>
            <span class="icon" style="font-size:16px">palette</span>
            {show_legend ? 'Hide' : 'Legend'}
        </button>
    </div>

    {#if show_legend}
        <div class="legend">
            {#each legend_types as lt (lt.key)}
                <span class="legend-item">
                    <span class="legend-dot" style:background={lt.color}></span>
                    {lt.label}
                </span>
            {/each}
        </div>
    {/if}

    <DagGraph {nodes} {edges} {selected_id} {on_node_click} />
</div>

<style>
    .dag-view {
        margin-bottom: 1.25rem;
    }

    .dag-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .dag-title {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .legend-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg-muted);
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-family: var(--font);
    }

    .legend-toggle:hover {
        color: var(--fg);
        border-color: var(--fg-muted);
    }

    .legend-toggle:focus-visible { box-shadow: var(--focus-ring); outline: none; }

    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 0.5rem;
    }

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.7rem;
        color: var(--fg-muted);
    }

    .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }
</style>

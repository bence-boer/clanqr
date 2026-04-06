<script lang="ts">
    import { get_agent_visual } from '../agent-type-badge/agent-type-colors';
    import { compute_dag_layout } from './dag-layout';
    import type { DagEdge, DagLayout, DagNode } from './types';

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

    const layout: DagLayout = $derived(compute_dag_layout(nodes, edges));

    function status_icon(status: string): string {
        if (status === 'completed') return 'check_circle';
        if (status === 'running' || status === 'in_progress') return 'sync';
        if (status === 'failed') return 'error';
        if (status === 'queued' || status === 'approved') return 'schedule';
        return 'radio_button_unchecked';
    }

    function is_running(status: string): boolean {
        return status === 'running' || status === 'in_progress';
    }
</script>

{#if layout.nodes.length > 0}
    <div class="dag-container">
        <svg
            viewBox="0 0 {layout.width} {layout.height}"
            width={layout.width}
            height={layout.height}
            class="dag-svg"
            role="img"
            aria-label="Task dependency graph"
        >
            <defs>
                <marker id="dag-arrow" viewBox="0 0 10 7" refX="10" refY="3.5"
                    markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--fg-muted)" opacity="0.5" />
                </marker>
            </defs>

            <!-- Edges -->
            {#each layout.edges as edge (edge.from + '-' + edge.to)}
                <path
                    d={edge.path}
                    fill="none"
                    stroke="var(--border)"
                    stroke-width="1.5"
                    marker-end="url(#dag-arrow)"
                />
            {/each}

            <!-- Nodes via foreignObject -->
            {#each layout.nodes as ln (ln.id)}
                {@const visual = get_agent_visual(ln.node.agent_type)}
                <foreignObject x={ln.x} y={ln.y} width={ln.width} height={ln.height}>
                    <button
                        class="dag-node"
                        class:selected={selected_id === ln.id}
                        class:running={is_running(ln.node.status)}
                        style:--node-color={visual.color}
                        onclick={() => on_node_click?.(ln.id)}
                        title={ln.node.label}
                    >
                        <span class="node-icon icon"
                            class:spin={is_running(ln.node.status)}
                            style="font-size:16px"
                        >
                            {status_icon(ln.node.status)}
                        </span>
                        <span class="node-content">
                            <span class="node-label">{ln.node.label}</span>
                            <span class="node-type">{visual.label}</span>
                        </span>
                    </button>
                </foreignObject>
            {/each}
        </svg>
    </div>
{/if}

<style>
    .dag-container {
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg);
    }

    .dag-svg {
        display: block;
        min-width: 100%;
    }

    .dag-node {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        height: 100%;
        padding: 0.4rem 0.6rem;
        background: var(--bg-surface);
        border: 1.5px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        cursor: pointer;
        font-family: var(--font);
        text-align: left;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .dag-node:hover {
        border-color: var(--node-color);
    }

    .dag-node.selected {
        border-color: var(--node-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--node-color) 25%, transparent);
    }

    .dag-node.running {
        animation: pulse-border 2s ease-in-out infinite;
    }

    @keyframes pulse-border {
        0%, 100% { border-color: var(--border); }
        50% { border-color: var(--node-color); }
    }

    .node-icon {
        flex-shrink: 0;
        color: var(--node-color);
    }

    .node-content {
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .node-label {
        font-size: 0.75rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .node-type {
        font-size: 0.65rem;
        color: var(--fg-muted);
    }
</style>

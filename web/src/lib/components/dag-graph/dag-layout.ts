import type { DagEdge, DagLayout, DagLayoutEdge, DagLayoutNode, DagNode } from './types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;
const H_GAP = 60;
const V_GAP = 32;
const PADDING = 40;

/**
 * Assign layers using Kahn's algorithm (topological sort by longest path).
 */
function assign_layers(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
    const in_edges = new Map<string, Set<string>>();
    const out_edges = new Map<string, Set<string>>();
    const node_ids = new Set(nodes.map((n) => n.id));

    for (const id of node_ids) {
        in_edges.set(id, new Set());
        out_edges.set(id, new Set());
    }

    for (const edge of edges) {
        if (!node_ids.has(edge.from) || !node_ids.has(edge.to)) continue;
        out_edges.get(edge.from)?.add(edge.to);
        in_edges.get(edge.to)?.add(edge.from);
    }

    // Longest-path layering via BFS
    const layer_map = new Map<string, number>();
    const queue: string[] = [];
    const in_queue = new Set<string>();

    for (const id of node_ids) {
        if ((in_edges.get(id)?.size ?? 0) === 0) {
            queue.push(id);
            in_queue.add(id);
            layer_map.set(id, 0);
        }
    }

    // Handle cycles: assign remaining nodes to layer 0
    if (queue.length === 0 && node_ids.size > 0) {
        const first = node_ids.values().next().value as string;
        queue.push(first);
        in_queue.add(first);
        layer_map.set(first, 0);
    }

    let head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        const current_layer = layer_map.get(current) ?? 0;
        for (const next of out_edges.get(current) ?? []) {
            const prev_layer = layer_map.get(next) ?? -1;
            if (current_layer + 1 > prev_layer) {
                layer_map.set(next, current_layer + 1);
            }
            // Only add to queue if all parents processed
            const parents = in_edges.get(next) ?? new Set<string>();
            const all_done = [...parents].every((p) => layer_map.has(p));
            if (all_done && !in_queue.has(next)) {
                queue.push(next);
                in_queue.add(next);
            }
        }
    }

    // Assign unvisited nodes (disconnected) to layer 0
    for (const id of node_ids) {
        if (!layer_map.has(id)) layer_map.set(id, 0);
    }

    return layer_map;
}

/**
 * Compute x/y positions for each node and Bézier edge paths.
 */
export function compute_dag_layout(nodes: DagNode[], edges: DagEdge[]): DagLayout {
    if (nodes.length === 0) {
        return { nodes: [], edges: [], width: 0, height: 0 };
    }

    const layer_map = assign_layers(nodes, edges);
    const max_layer = Math.max(...layer_map.values(), 0);

    // Group nodes by layer
    const layers: DagNode[][] = Array.from({ length: max_layer + 1 }, () => []);
    for (const node of nodes) {
        const layer = layer_map.get(node.id) ?? 0;
        layers[layer].push(node);
    }

    // Assign coordinates
    const layout_nodes: DagLayoutNode[] = [];
    const node_positions = new Map<string, { x: number, y: number }>();

    for (let layer = 0; layer <= max_layer; layer++) {
        const layer_nodes = layers[layer];
        const layer_height = layer_nodes.length * NODE_HEIGHT + (layer_nodes.length - 1) * V_GAP;
        const start_y = PADDING;

        for (let i = 0; i < layer_nodes.length; i++) {
            const x = PADDING + layer * (NODE_WIDTH + H_GAP);
            const y_offset = (layers.reduce((mx, l) => Math.max(mx, l.length), 0) * (NODE_HEIGHT + V_GAP) - V_GAP) / 2;
            const y = start_y + (y_offset - layer_height / 2) + i * (NODE_HEIGHT + V_GAP);

            const pos = { x, y };
            node_positions.set(layer_nodes[i].id, pos);
            layout_nodes.push({
                id: layer_nodes[i].id,
                x: pos.x,
                y: pos.y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                layer,
                node: layer_nodes[i]
            });
        }
    }

    // Compute Bézier edge paths
    const layout_edges: DagLayoutEdge[] = [];
    for (const edge of edges) {
        const from_pos = node_positions.get(edge.from);
        const to_pos = node_positions.get(edge.to);
        if (!from_pos || !to_pos) continue;

        const x1 = from_pos.x + NODE_WIDTH;
        const y1 = from_pos.y + NODE_HEIGHT / 2;
        const x2 = to_pos.x;
        const y2 = to_pos.y + NODE_HEIGHT / 2;
        const cp_offset = Math.abs(x2 - x1) * 0.4;

        layout_edges.push({
            from: edge.from,
            to: edge.to,
            path: `M ${x1} ${y1} C ${x1 + cp_offset} ${y1}, ${x2 - cp_offset} ${y2}, ${x2} ${y2}`
        });
    }

    // Compute bounding box
    const total_width = layout_nodes.reduce((mx, n) => Math.max(mx, n.x + n.width), 0) + PADDING;
    const total_height = layout_nodes.reduce((mx, n) => Math.max(mx, n.y + n.height), 0) + PADDING;

    return { nodes: layout_nodes, edges: layout_edges, width: total_width, height: total_height };
}

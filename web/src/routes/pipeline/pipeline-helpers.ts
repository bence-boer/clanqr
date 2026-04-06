import { api } from '$lib/api/client';
import type { DagEdge, DagNode } from '$lib/components/dag-graph';
import type { WaveInfo } from '$lib/components/wave-progress';
import { toast_store } from '$lib/stores/toast.svelte';

export function format_duration(started_at: string | null): string {
    if (!started_at) return '';
    const elapsed = Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const m = Math.floor(elapsed / 60);
    return `${m}m ${elapsed % 60}s`;
}

export async function reorder_queue(task_ids: string[], reload: () => Promise<void>): Promise<void> {
    try {
        await api.pipeline_reorder(task_ids);
        toast_store.success('Queue reordered');
    }
    catch (err) {
        console.error('Failed to reorder queue:', err);
        toast_store.error('Failed to reorder queue');
        await reload();
    }
}

export async function remove_from_queue(task_id: string, reload: () => Promise<void>): Promise<void> {
    try {
        await api.update_task(task_id, { status: 'queued' } as never);
        toast_store.success('Task removed');
        await reload();
    }
    catch (err) {
        console.error('Failed to remove from queue:', err);
        toast_store.error('Failed to remove from queue');
    }
}

export async function retry_task(task_id: string, reload: () => Promise<void>): Promise<void> {
    try {
        await api.approve_task(task_id);
        toast_store.success('Task requeued');
        await reload();
    }
    catch (err) {
        console.error('Failed to retry task:', err);
        toast_store.error('Failed to retry task');
    }
}

export interface DagData {
    nodes: DagNode[]
    edges: DagEdge[]
    waves: WaveInfo[]
}

export function map_dag_response(raw: unknown): DagData {
    const data = raw as Record<string, unknown>;
    const raw_nodes = (data.nodes ?? []) as Record<string, unknown>[];
    const raw_edges = (data.edges ?? []) as Record<string, unknown>[];

    const nodes: DagNode[] = raw_nodes.map((n) => ({
        id: n.id as string,
        label: (n.title as string) ?? (n.id as string),
        status: n.status as string,
        agent_type: n.agent_type as string,
        wave: (n.wave_number as number | null) ?? undefined,
        verification_status: (n.verification_status as string) ?? undefined,
        description: (n.description as string) ?? undefined,
        depends_on: (n.depends_on as string[]) ?? undefined
    }));

    const edges: DagEdge[] = raw_edges.map((e) => ({
        from: (e.from_task_id ?? e.from) as string,
        to: (e.to_task_id ?? e.to) as string
    }));

    const wave_count = (data.wave_count as number) ?? 0;
    const waves: WaveInfo[] = [];
    for (let w = 1; w <= wave_count; w++) {
        const wave_nodes = nodes.filter((n) => n.wave === w);
        const all_done = wave_nodes.every((n) => n.status === 'completed');
        const any_fail = wave_nodes.some((n) => n.status === 'failed');
        const any_run = wave_nodes.some((n) => n.status === 'running' || n.status === 'in_progress');
        let status: WaveInfo['status'] = 'pending';
        if (all_done && wave_nodes.length > 0) status = 'completed';
        else if (any_fail) status = 'failed';
        else if (any_run) status = 'running';
        waves.push({ wave: w, status, task_count: wave_nodes.length });
    }
    return { nodes, edges, waves };
}

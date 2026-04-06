/** DAG Service — validation, insertion, topological sort, wave computation, readiness queries. */
import { create_supabase_client, type TypedSupabaseClient } from '../db';
import type { Database } from '../database.types';
import { logger } from '../utils/logger';
export interface DagTask {
    task_id: string
    description: string
    assignee_role: string
    dependencies: string[]
    context_paths: string[]
    execution_strategy: 'parallel' | 'sequential' | 'background'
    skills: string[]
    definition_of_done: string
}
export interface DagNode {
    id: string
    title: string | null
    agent_type: string
    status: string
    wave_number: number | null
    verification_status: string
}
export interface DagEdge {
    from_task_id: string
    to_task_id: string
}
export interface DagGraph {
    nodes: DagNode[]
    edges: DagEdge[]
    wave_count: number
}
type AgentType = Database['public']['Enums']['agent_type'];
type ExecutionStrategy = Database['public']['Enums']['execution_strategy'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
const NODE_SELECT = 'id, title, agent_type, status, wave_number, verification_status' as const;
function to_node(r: DagNode): DagNode {
    return { ...r };
}
function build_graph(ids: Set<string>, edges: { from: string, to: string }[]) {
    const in_deg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const id of ids) {
        in_deg.set(id, 0);
        adj.set(id, []);
    }
    for (const e of edges) {
        adj.get(e.from)?.push(e.to);
        in_deg.set(e.to, (in_deg.get(e.to) ?? 0) + 1);
    }
    return { in_deg, adj };
}
/** Returns sorted levels, or null on cycle. */
function kahns_levels(ids: Set<string>, edges: { from: string, to: string }[]): string[][] | null {
    const { in_deg, adj } = build_graph(ids, edges);
    const levels: string[][] = [];
    let cur = [...ids].filter((id) => in_deg.get(id) === 0);
    let count = 0;
    while (cur.length > 0) {
        levels.push(cur);
        count += cur.length;
        const next: string[] = [];
        for (const n of cur) {
            for (const nb of adj.get(n) ?? []) {
                const d = (in_deg.get(nb) ?? 1) - 1;
                in_deg.set(nb, d);
                if (d === 0) {
                    next.push(nb);
                }
            }
        }
        cur = next;
    }
    return count < ids.size ? null : levels;
}
export function validate_dag(tasks: DagTask[]): { valid: boolean, errors: string[] } {
    const errors: string[] = [];
    const id_set = new Set(tasks.map((t) => t.task_id));
    for (const t of tasks) {
        for (const dep of t.dependencies) {
            if (!id_set.has(dep)) {
                errors.push(`Task "${t.task_id}" depends on unknown task "${dep}"`);
            }
        }
    }
    const edges = tasks.flatMap((t) =>
        t.dependencies.filter((d) => id_set.has(d)).map((d) => ({ from: d, to: t.task_id }))
    );
    if (kahns_levels(id_set, edges) === null) {
        errors.push('Cycle detected in task dependency graph');
    }
    return { valid: errors.length === 0, errors };
}
export async function insert_dag_from_plan(
    feature_id: string, tasks: DagTask[], supabase?: TypedSupabaseClient
): Promise<{ task_id_map: Map<string, string> }> {
    const db = supabase ?? create_supabase_client();
    const task_id_map = new Map<string, string>();
    const rows = tasks.map((t, idx) => ({
        feature_id,
        description: t.description,
        agent_type: t.assignee_role as AgentType,
        execution_strategy: t.execution_strategy as ExecutionStrategy,
        skills: t.skills as unknown as TaskInsert['skills'],
        context_paths: t.context_paths as unknown as TaskInsert['context_paths'],
        definition_of_done: t.definition_of_done,
        sort_order: idx
    }));
    const { data: inserted, error } = await db.from('tasks').insert(rows).select('id');
    if (error || !inserted) {
        logger.error('Failed to insert DAG tasks', { service: 'dag', error: error?.message });
        return { task_id_map };
    }
    for (let i = 0; i < tasks.length; i++) {
        task_id_map.set(tasks[i].task_id, inserted[i].id);
    }
    const dep_rows: { task_id: string, depends_on_task_id: string }[] = [];
    for (const t of tasks) {
        const db_id = task_id_map.get(t.task_id);
        if (!db_id) {
            continue;
        }
        for (const dep of t.dependencies) {
            const dep_db_id = task_id_map.get(dep);
            if (dep_db_id) {
                dep_rows.push({ task_id: db_id, depends_on_task_id: dep_db_id });
            }
        }
    }
    if (dep_rows.length > 0) {
        const { error: dep_err } = await db.from('task_dependencies').insert(dep_rows);
        if (dep_err) {
            logger.error('Failed to insert dependencies', { service: 'dag', error: dep_err.message });
        }
    }
    return { task_id_map };
}
export async function compute_waves(feature_id: string, supabase?: TypedSupabaseClient): Promise<number> {
    const db = supabase ?? create_supabase_client();
    const { data: tasks, error: t_err } = await db.from('tasks').select('id').eq('feature_id', feature_id);
    if (t_err || !tasks || tasks.length === 0) {
        return 0;
    }
    const task_ids = new Set(tasks.map((t) => t.id));
    const { data: deps, error: d_err } = await db
        .from('task_dependencies').select('task_id, depends_on_task_id').in('task_id', [...task_ids]);
    if (d_err) {
        logger.error('Failed to query task_dependencies', { service: 'dag', error: d_err.message });
        return -1;
    }
    const edges = (deps ?? []).map((d) => ({ from: d.depends_on_task_id, to: d.task_id }));
    const levels = kahns_levels(task_ids, edges);
    if (!levels) {
        logger.error('Cycle detected during wave computation', { service: 'dag', feature_id });
        return -1;
    }
    for (let w = 0; w < levels.length; w++) {
        await db.from('tasks').update({ wave_number: w }).in('id', levels[w]);
    }
    return levels.length;
}
export async function get_ready_tasks(feature_id: string, supabase?: TypedSupabaseClient): Promise<DagNode[]> {
    const db = supabase ?? create_supabase_client();
    const { data: approved, error } = await db
        .from('tasks').select(NODE_SELECT).eq('feature_id', feature_id).eq('status', 'approved');
    if (error || !approved || approved.length === 0) {
        return [];
    }
    const ids = approved.map((t) => t.id);
    const { data: deps } = await db.from('task_dependencies').select('task_id, depends_on_task_id').in('task_id', ids);
    if (!deps || deps.length === 0) {
        return approved.map(to_node);
    }
    const dep_ids = [...new Set(deps.map((d) => d.depends_on_task_id))];
    const { data: dep_tasks } = await db.from('tasks').select('id, status, verification_status').in('id', dep_ids);
    const dep_map = new Map((dep_tasks ?? []).map((t) => [t.id, t]));
    const ok_s = new Set(['complete', 'skipped']);
    const ok_v = new Set(['approved', 'skipped']);
    const blocked = new Set<string>();
    for (const d of deps) {
        const s = dep_map.get(d.depends_on_task_id);
        if (!s || !ok_s.has(s.status) || !ok_v.has(s.verification_status)) {
            blocked.add(d.task_id);
        }
    }
    return approved.filter((t) => !blocked.has(t.id)).map(to_node);
}
export async function get_dag(feature_id: string, supabase?: TypedSupabaseClient): Promise<DagGraph> {
    const db = supabase ?? create_supabase_client();
    const { data: tasks } = await db.from('tasks').select(NODE_SELECT).eq('feature_id', feature_id);
    const nodes = (tasks ?? []).map(to_node);
    const ids = nodes.map((n) => n.id);
    let edges: DagEdge[] = [];
    if (ids.length > 0) {
        const { data: deps } = await db
            .from('task_dependencies').select('depends_on_task_id, task_id').in('task_id', ids);
        edges = (deps ?? []).map((d) => ({ from_task_id: d.depends_on_task_id, to_task_id: d.task_id }));
    }
    const max_w = nodes.reduce((mx, n) => Math.max(mx, n.wave_number ?? -1), -1);
    return { nodes, edges, wave_count: max_w >= 0 ? max_w + 1 : 0 };
}

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { pipeline_service } from '../services/pipeline_service';
import { get_session_concurrency } from '../services/session_pool_service';
import { plan_feature } from '../services/sdk_session_service';
import { prompt_service } from '../services/prompt_service';
import { log_store } from '../services/log_store_service';
import { get_dag } from '../services/dag_service';
import { dispatch_verifier } from '../services/verification_service';
import { logger } from '../utils/logger';

const reorder_schema = z.object({
    task_ids: z.array(z.string().uuid()).min(1).max(100)
});

function summarize_entry(type: string, data: Record<string, unknown> = {}): string {
    if (type === 'tool_start' || type === 'tool_complete') return `${data.tool_name ?? 'unknown'}`;
    if (type === 'agent_output' || type === 'agent_message') {
        const text = String(data.text ?? data.content ?? '');
        return text.length > 120 ? text.slice(0, 120) + '…' : text;
    }
    if (type === 'usage') return `${data.input_tokens ?? 0}in/${data.output_tokens ?? 0}out`;
    if (type === 'error' || type === 'warning') return String(data.message ?? data.text ?? type);
    return type;
}

export const agents_routes = new Hono<AppBindings>()
    // ── Pipeline status & controls ────────────────────────────────────────────
    .get('/queue', async (context) => {
        const supabase = context.get('supabase');
        const pipeline_info = pipeline_service.get_status();
        const { count } = await supabase
            .from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'approved');

        let active_tasks: Record<string, unknown>[] = [];
        if (pipeline_info.active_task_ids.length > 0) {
            const { data } = await supabase.from('tasks')
                .select('*, features(id, title, project_id, projects(id, name))')
                .in('id', pipeline_info.active_task_ids);
            active_tasks = (data ?? []).map((t) => ({
                ...t, feature_title: t.features?.title ?? 'Unknown',
                feature_id: t.features?.id ?? null,
                project_name: t.features?.projects?.name ?? 'Unknown',
                project_id: t.features?.projects?.id ?? null
            }));
        }
        return context.json({
            state: pipeline_info.state, active_tasks,
            active_run_count: pipeline_info.active_run_count,
            current_feature_id: pipeline_info.current_feature_id,
            wave_info: pipeline_info.wave_info, queue_depth: count ?? 0
        });
    })

    .post('/pause', (c) => {
        pipeline_service.pause();
        return c.json({ success: true, state: 'paused' });
    })
    .post('/resume', (c) => {
        pipeline_service.resume();
        return c.json({ success: true, state: 'resuming' });
    })
    .post('/stop-current', (c) => {
        pipeline_service.stop_current();
        return c.json({ success: true });
    })
    .get('/queue/log', (c) => c.json({ log: pipeline_service.get_log() }))

    .patch('/queue/reorder', zValidator('json', reorder_schema), async (context) => {
        const supabase = context.get('supabase');
        const { task_ids } = context.req.valid('json');
        try {
            for (let i = 0; i < task_ids.length; i++) {
                const { error } = await supabase.from('tasks')
                    .update({ sort_order: i }).eq('id', task_ids[i]).eq('status', 'approved');
                if (error) throw error;
            }
            return context.json({ success: true });
        }
        catch (error) {
            logger.error('Failed to reorder tasks', { route: 'PATCH /api/agents/queue/reorder', error: String(error) });
            return context.json({ error: 'Failed to reorder tasks' }, 500);
        }
    })

// ── SDK session management ────────────────────────────────────────────────
    .get('/sessions', (c) => c.json(get_session_concurrency()))

    .post('/plan/:feature_id', validate_uuid_params('feature_id'), async (context) => {
        const feature_id = require_param(context, 'feature_id');
        const supabase = context.get('supabase');

        const { data: feature, error } = await supabase
            .from('features')
            .select('*, resources(*), projects(*)')
            .eq('id', feature_id)
            .single();

        if (error || !feature) return context.json({ error: 'Feature not found' }, 404);

        try {
            const prompt = await prompt_service.resolve_for_manager(
                {
                    title: feature.title, description: feature.description,
                    project: feature.projects?.name ?? 'Unknown',
                    resources: (feature.resources ?? []).map((r: { url: string, title: string | null }) => ({ url: r.url, title: r.title }))
                },
                feature_id, feature.project_id, supabase
            );
            const model = feature.planning_model || 'gpt-4.1';
            plan_feature(feature_id, model, prompt).catch((err) =>
                logger.error('Plan feature error', { service: 'agents', feature_id, error: String(err) })
            );
            return context.json({ success: true, message: 'Planning session started' });
        }
        catch (err) {
            logger.error('Failed to start plan', { route: 'POST /api/agents/plan/:feature_id', feature_id, error: String(err) });
            return context.json({ error: 'Failed to start planning' }, 500);
        }
    })

    .get('/status', async (context) => {
        const supabase = context.get('supabase');
        const one_hour_ago = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const cols = 'id, agent_type, status, sdk_session_id, started_at, finished_at, feature_id, task_id, model, prompt_tokens, completion_tokens, estimated_cost';
        const { data: running } = await supabase.from('agent_sessions')
            .select(cols)
            .in('status', ['running', 'pending'])
            .order('started_at', { ascending: false });
        const { data: recent } = await supabase.from('agent_sessions')
            .select(cols)
            .in('status', ['completed', 'failed', 'cancelled'])
            .gte('finished_at', one_hour_ago)
            .order('finished_at', { ascending: false })
            .limit(20);
        return context.json([...(running ?? []), ...(recent ?? [])]);
    })

    .post('/stop-all', async (context) => {
        const supabase = context.get('supabase');
        await supabase.from('agent_sessions')
            .update({ status: 'cancelled', finished_at: new Date().toISOString() })
            .eq('status', 'running');
        return context.json({ success: true, message: 'All agents stopped' });
    })

    .get('/logs/:session_id', async (context) => {
        const session_id = context.req.param('session_id');
        if (!session_id) return context.json({ error: 'Missing session_id' }, 400);
        const raw_entries = log_store.get(session_id);
        if (raw_entries.length === 0) {
            const supabase = context.get('supabase');
            const { data } = await supabase.from('agent_sessions')
                .select('summary, error, status').eq('sdk_session_id', session_id).single();
            if (data) {
                const fallback = data.error
                    ? `Status: ${data.status}\nError: ${data.error}`
                    : `Status: ${data.status}${data.summary ? `\nSummary: ${data.summary}` : ''}`;
                return context.json({ entries: [], text: fallback });
            }
        }
        const entries = raw_entries.map((e) => ({
            timestamp: e.timestamp, type: e.type,
            summary: summarize_entry(e.type, e.data as Record<string, unknown>)
        }));
        return context.json({ entries });
    })

    // ── DAG visualization ─────────────────────────────────────────────────────
    .get('/dag/:feature_id', validate_uuid_params('feature_id'), async (context) => {
        const feature_id = require_param(context, 'feature_id');
        try {
            const dag = await get_dag(feature_id);
            return context.json(dag);
        }
        catch (error) {
            logger.error('Failed to get DAG', { route: 'GET /api/agents/dag/:feature_id', feature_id, error: String(error) });
            return context.json({ error: 'Failed to get DAG' }, 500);
        }
    })

    // ── Manual verification trigger ───────────────────────────────────────────
    .post('/verify/:task_id', validate_uuid_params('task_id'), async (context) => {
        const task_id = require_param(context, 'task_id');
        const supabase = context.get('supabase');

        const { data: task } = await supabase.from('tasks')
            .select('id, feature_id, agent_type, definition_of_done')
            .eq('id', task_id)
            .single();

        if (!task) return context.json({ error: 'Task not found' }, 404);

        try {
            const result = await dispatch_verifier(task_id, task.feature_id, supabase);
            return context.json(result);
        }
        catch (error) {
            logger.error('Verification failed', { route: 'POST /api/agents/verify/:task_id', task_id, error: String(error) });
            return context.json({ error: 'Verification failed' }, 500);
        }
    });

import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { pipeline_service } from '../services/pipeline_service';
import { get_session_concurrency } from '../services/session_pool_service';
import { plan_feature } from '../services/sdk_session_service';
import { prompt_service } from '../services/prompt_service';
import { log_store } from '../services/log_store_service';
import { logger } from '../utils/logger';

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
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'approved');

        let current_task = null;
        if (pipeline_info.current_task_id) {
            const { data } = await supabase
                .from('tasks')
                .select('*, features(id, title, project_id, projects(id, name))')
                .eq('id', pipeline_info.current_task_id)
                .single();
            if (data) {
                current_task = {
                    ...data,
                    feature_title: data.features?.title ?? 'Unknown',
                    feature_id: data.features?.id ?? null,
                    project_name: data.features?.projects?.name ?? 'Unknown',
                    project_id: data.features?.projects?.id ?? null
                };
            }
        }

        return context.json({
            state: pipeline_info.state,
            current_task,
            current_run_id: pipeline_info.current_run_id,
            current_sdk_session_id: pipeline_info.current_sdk_session_id,
            queue_depth: count ?? 0
        });
    })

    .post('/pause', (context) => {
        pipeline_service.pause();
        return context.json({ success: true, state: 'paused' });
    })

    .post('/resume', (context) => {
        pipeline_service.resume();
        return context.json({ success: true, state: 'resuming' });
    })

    .post('/stop-current', (context) => {
        pipeline_service.stop_current();
        return context.json({ success: true });
    })

    .get('/queue/log', (context) => {
        const log = pipeline_service.get_log();
        return context.json({ log });
    })

    .patch('/queue/reorder', async (context) => {
        const supabase = context.get('supabase');
        const body = await context.req.json();
        const task_ids: string[] = body.task_ids;
        if (!Array.isArray(task_ids) || task_ids.length === 0) {
            return context.json({ error: 'task_ids must be a non-empty array' }, 400);
        }

        for (let i = 0; i < task_ids.length; i++) {
            const { error } = await supabase.from('tasks')
                .update({ sort_order: i })
                .eq('id', task_ids[i])
                .eq('status', 'approved');
            if (error) return context.json({ error: error.message }, 500);
        }
        return context.json({ success: true });
    })

// ── SDK session management ────────────────────────────────────────────────

    .get('/sessions', (context) => {
        const concurrency = get_session_concurrency();
        return context.json(concurrency);
    })

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
        const { data } = await supabase.from('agent_sessions')
            .select('id, agent_type, status, sdk_session_id, started_at, finished_at, feature_id, task_id')
            .in('status', ['running', 'pending'])
            .order('started_at', { ascending: false });
        return context.json(data ?? []);
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
                .select('summary, error, status')
                .eq('sdk_session_id', session_id)
                .single();
            if (data) {
                const fallback = data.error
                    ? `Status: ${data.status}\nError: ${data.error}`
                    : data.summary
                        ? `Status: ${data.status}\nSummary: ${data.summary}`
                        : `Status: ${data.status}`;
                return context.json({ entries: [], text: fallback });
            }
        }

        const entries = raw_entries.map((e) => ({
            timestamp: e.timestamp,
            type: e.type,
            summary: summarize_entry(e.type, e.data as Record<string, unknown>)
        }));
        return context.json({ entries });
    });

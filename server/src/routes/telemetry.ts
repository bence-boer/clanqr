/** Telemetry API routes — exposes rich SDK event data for monitoring UI. */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppBindings } from '../middleware/supabase';
import { log_store } from '../services/log_store_service';
import { stream_service } from '../services/stream_service';
import { logger } from '../utils/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve an ID that may be a UUID (agent_sessions.id) or an SDK session string. */
async function resolve_session_uuid(
    db: SupabaseClient, raw_id: string
): Promise<string | null> {
    if (UUID_RE.test(raw_id)) return raw_id;
    const { data } = await db.from('agent_sessions')
        .select('id').eq('sdk_session_id', raw_id).limit(1).single();
    return data?.id ?? null;
}

export const telemetry_routes = new Hono<AppBindings>()

    /** Paginated agent_events from DB for a session */
    .get('/sessions/:id/events', async (context) => {
        const supabase = context.get('supabase');
        const uuid = await resolve_session_uuid(supabase, context.req.param('id'));
        if (!uuid) return context.json({ events: [], total: 0, page: 1, per_page: 50 });

        const page = Number(context.req.query('page') ?? '1');
        const per_page = Math.min(Number(context.req.query('per_page') ?? '50'), 200);
        const type_filter = context.req.query('type');
        const offset = (page - 1) * per_page;

        let query = supabase.from('agent_events')
            .select('*', { count: 'exact' })
            .eq('agent_session_id', uuid)
            .order('created_at', { ascending: true })
            .range(offset, offset + per_page - 1);

        if (type_filter) query = query.eq('event_type', type_filter);

        const { data, count, error } = await query;
        if (error) {
            logger.error('Telemetry query failed', { route: 'GET /api/telemetry/sessions/:id/events', error: String(error) });
            return context.json({ error: 'Internal server error' }, 500);
        }

        return context.json({ events: data ?? [], total: count ?? 0, page, per_page });
    })

    /** Agent tool calls from DB for a session */
    .get('/sessions/:id/tools', async (context) => {
        const supabase = context.get('supabase');
        const uuid = await resolve_session_uuid(supabase, context.req.param('id'));
        if (!uuid) return context.json({ tools: [] });

        const { data, error } = await supabase.from('agent_tool_calls')
            .select('*').eq('agent_session_id', uuid)
            .order('created_at', { ascending: true });

        if (error) {
            logger.error('Telemetry query failed', { route: 'GET /api/telemetry/sessions/:id/tools', error: String(error) });
            return context.json({ error: 'Internal server error' }, 500);
        }
        return context.json({ tools: data ?? [] });
    })

    /** Full session summary with rich telemetry */
    .get('/sessions/:id/summary', async (context) => {
        const supabase = context.get('supabase');
        const uuid = await resolve_session_uuid(supabase, context.req.param('id'));
        if (!uuid) return context.json({ error: 'Session not found' }, 404);

        const { data, error } = await supabase.from('agent_sessions')
            .select('*, tasks!agent_sessions_task_id_fkey(id, title, feature_id, features(id, title, project_id, projects(id, name)))')
            .eq('id', uuid).single();

        if (error || !data) return context.json({ error: 'Session not found' }, 404);

        const { count: event_count } = await supabase.from('agent_events')
            .select('id', { count: 'exact', head: true })
            .eq('agent_session_id', uuid);

        const { count: tool_count } = await supabase.from('agent_tool_calls')
            .select('id', { count: 'exact', head: true })
            .eq('agent_session_id', uuid);

        return context.json({
            ...data,
            event_count: event_count ?? 0,
            tool_count: tool_count ?? 0
        });
    })

    /** In-memory structured log entries (for live/recent sessions) */
    .get('/sessions/:sdk_id/logs', async (context) => {
        const sdk_session_id = context.req.param('sdk_id');
        const after = Number(context.req.query('after') ?? '0');

        const entries = after > 0
            ? log_store.get_since(sdk_session_id, after)
            : log_store.get(sdk_session_id);

        return context.json({
            entries,
            total: log_store.count(sdk_session_id),
            has_more: log_store.count(sdk_session_id) > after + entries.length
        });
    })

    /** SSE live stream of all session events */
    .get('/sessions/:sdk_id/stream', (context) => {
        const sdk_session_id = context.req.param('sdk_id');
        return streamSSE(context, async (stream) => {
            const unsubscribe = stream_service.subscribe(sdk_session_id, (event) => {
                stream.writeSSE({
                    event: event.type,
                    data: JSON.stringify(event)
                }).catch(() => {
                    /* client disconnected */
                });
            });

            stream.onAbort(() => unsubscribe());

            // Keep alive with pings
            while (true) {
                await stream.writeSSE({ event: 'ping', data: '' });
                await stream.sleep(15_000);
            }
        });
    });

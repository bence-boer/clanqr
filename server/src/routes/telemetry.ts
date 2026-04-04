/** Telemetry API routes — exposes rich SDK event data for monitoring UI. */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppBindings } from '../middleware/supabase';
import { log_store } from '../services/log_store_service';
import { stream_service } from '../services/stream_service';

export const telemetry_routes = new Hono<AppBindings>()

    /** Paginated agent_events from DB for a session */
    .get('/sessions/:id/events', async (context) => {
        const supabase = context.get('supabase');
        const session_id = context.req.param('id');
        const page = Number(context.req.query('page') ?? '1');
        const per_page = Math.min(Number(context.req.query('per_page') ?? '50'), 200);
        const type_filter = context.req.query('type');
        const offset = (page - 1) * per_page;

        let query = supabase.from('agent_events')
            .select('*', { count: 'exact' })
            .eq('agent_session_id', session_id)
            .order('created_at', { ascending: true })
            .range(offset, offset + per_page - 1);

        if (type_filter) query = query.eq('event_type', type_filter);

        const { data, count, error } = await query;
        if (error) return context.json({ error: error.message }, 500);

        return context.json({
            events: data ?? [],
            total: count ?? 0,
            page,
            per_page
        });
    })

    /** Agent tool calls from DB for a session */
    .get('/sessions/:id/tools', async (context) => {
        const supabase = context.get('supabase');
        const session_id = context.req.param('id');

        const { data, error } = await supabase.from('agent_tool_calls')
            .select('*')
            .eq('agent_session_id', session_id)
            .order('created_at', { ascending: true });

        if (error) return context.json({ error: error.message }, 500);
        return context.json({ tools: data ?? [] });
    })

    /** Full session summary with rich telemetry */
    .get('/sessions/:id/summary', async (context) => {
        const supabase = context.get('supabase');
        const session_id = context.req.param('id');

        const { data, error } = await supabase.from('agent_sessions')
            .select('*, tasks(id, title, feature_id, features(id, title, project_id, projects(id, name)))')
            .eq('id', session_id)
            .single();

        if (error || !data) return context.json({ error: 'Session not found' }, 404);

        const { count: event_count } = await supabase.from('agent_events')
            .select('id', { count: 'exact', head: true })
            .eq('agent_session_id', session_id);

        const { count: tool_count } = await supabase.from('agent_tool_calls')
            .select('id', { count: 'exact', head: true })
            .eq('agent_session_id', session_id);

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

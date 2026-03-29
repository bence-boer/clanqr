import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { chat_send } from '../services/sdk_session_service';
import { logger } from '../utils/logger';

const create_session_schema = z.object({
    title: z.string().optional(),
    model: z.string().optional()
});

const update_session_schema = z.object({
    title: z.string().min(1).max(200)
});

const send_message_schema = z.object({
    content: z.string().min(1),
    model: z.string().optional()
});

export const chat_routes = new Hono<AppBindings>()


    .get('/sessions', async (context) => {
        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('agent_sessions')
            .select('id, summary, model, created_at, updated_at')
            .eq('agent_type', 'chat')
            .order('updated_at', { ascending: false });

        if (error) return context.json({ error: 'Failed to fetch sessions' }, 500);
        // Map summary → title for backward compatibility
        return context.json((data ?? []).map((s) => ({ ...s, title: s.summary })));
    })


    .post('/sessions', async (context) => {
        const body = await context.req.json();
        const result = create_session_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('agent_sessions')
            .insert({
                agent_type: 'chat',
                summary: result.data.title ?? null,
                model: result.data.model ?? 'claude-sonnet-4.5'
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create session', { route: 'POST /api/chat/sessions', error: String(error) });
            return context.json({ error: 'Failed to create session' }, 500);
        }
        return context.json({ ...data, title: data.summary }, 201);
    })


    .get('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data: session, error } = await supabase
            .from('agent_sessions')
            .select('*')
            .eq('id', id)
            .eq('agent_type', 'chat')
            .single();

        if (error || !session) return context.json({ error: 'Session not found' }, 404);

        const { data: messages } = await supabase
            .from('agent_events')
            .select('*')
            .eq('agent_session_id', id)
            .eq('event_type', 'chat.message')
            .order('created_at', { ascending: true });

        const formatted_messages = (messages ?? []).map((m) => ({
            id: m.id,
            session_id: id,
            role: ((m.event_data as Record<string, unknown>)?.role as string) ?? 'user',
            content: ((m.event_data as Record<string, unknown>)?.content as string) ?? '',
            created_at: m.created_at
        }));
        return context.json({ ...session, title: session.summary, chat_messages: formatted_messages });
    })

    .patch('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const body = await context.req.json();
        const result = update_session_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('agent_sessions')
            .update({ summary: result.data.title })
            .eq('id', id)
            .eq('agent_type', 'chat')
            .select()
            .single();

        if (error || !data) {
            logger.error('Failed to update session', { route: 'PATCH /api/chat/sessions/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update session' }, 500);
        }
        return context.json(data);
    })

    .delete('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = context.req.param('id');
        const supabase = context.get('supabase');

        const { error } = await supabase
            .from('agent_sessions')
            .delete()
            .eq('id', id)
            .eq('agent_type', 'chat');
        if (error) {
            logger.error('Failed to delete session', { route: 'DELETE /api/chat/sessions/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete session' }, 500);
        }
        return context.json({ success: true });
    })

    .post('/sessions/:id/send', validate_uuid_params('id'), async (context) => {
        const session_id = context.req.param('id');
        const supabase = context.get('supabase');

        const { data: session } = await supabase
            .from('agent_sessions')
            .select('id, model')
            .eq('id', session_id)
            .eq('agent_type', 'chat')
            .single();

        if (!session) return context.json({ error: 'Session not found' }, 404);

        const body = await context.req.json();
        const result = send_message_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const { content, model } = result.data;

        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        const sdk_result = await chat_send(session_id, model ?? session.model, content);
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ chunk: sdk_result.content })}\n\n`)
                        );
                        // Persist messages in agent_events
                        await supabase.from('agent_events').insert({
                            agent_session_id: session_id,
                            event_type: 'chat.message',
                            event_data: { role: 'user', content }
                        });
                        await supabase.from('agent_events').insert({
                            agent_session_id: session_id,
                            event_type: 'chat.message',
                            event_data: { role: 'assistant', content: sdk_result.content }
                        });
                        await supabase.from('agent_sessions').update({
                            updated_at: new Date().toISOString()
                        }).eq('id', session_id);

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                    }
                    catch (err) {
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
                        );
                    }
                    finally {
                        controller.close();
                    }
                }
            }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            }
        );
    });

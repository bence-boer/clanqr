import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppBindings } from '../middleware/supabase';
import { event_bus, type ServerEvent } from '../services/event_bus';
import { pipeline_service } from '../services/pipeline_service';
import { logger } from '../utils/logger';

const KEEPALIVE_INTERVAL_MS = 25_000;
const MAX_SSE_CONNECTIONS = 5;
let active_connections = 0;

export const events_routes = new Hono<AppBindings>()

    .get('/stream', (context) => {
        if (active_connections >= MAX_SSE_CONNECTIONS) {
            return context.json({ error: 'Too many active connections' }, 429);
        }
        active_connections++;

        return streamSSE(context, async (stream) => {
            let event_id = 0;
            let alive = true;

            stream.onAbort(() => {
                alive = false;
                active_connections = Math.max(0, active_connections - 1);
            });

            const pipeline_info = pipeline_service.get_status();

            await stream.writeSSE({
                data: JSON.stringify({ pipeline: pipeline_info }),
                event: 'snapshot',
                id: String(event_id++)
            });

            const event_queue: ServerEvent[] = [];
            let wake: (() => void) | null = null;

            const unsubscribe = event_bus.subscribe((event) => {
                event_queue.push(event);
                wake?.();
                wake = null;
            });

            try {
                while (alive) {
                    if (event_queue.length === 0) {
                        await Promise.race([
                            new Promise<void>((resolve) => {
                                wake = resolve;
                            }),
                            stream.sleep(KEEPALIVE_INTERVAL_MS)
                        ]);
                    }

                    while (event_queue.length > 0 && alive) {
                        const event = event_queue.shift();
                        if (!event) break;
                        await stream.writeSSE({
                            data: JSON.stringify(event.data),
                            event: event.type,
                            id: String(event_id++)
                        });
                    }

                    if (alive && event_queue.length === 0) {
                        await stream.writeSSE({
                            data: JSON.stringify({ timestamp: new Date().toISOString() }),
                            event: 'ping',
                            id: String(event_id++)
                        });
                    }
                }
            }
            catch (error) {
                if (alive) {
                    logger.error('SSE stream error', { route: 'GET /api/events/stream', error: String(error) });
                }
            }
            finally {
                unsubscribe();
                active_connections = Math.max(0, active_connections - 1);
            }
        });
    });

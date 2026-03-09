import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppBindings } from '../middleware/supabase';
import { event_bus, type ServerEvent } from '../services/event_bus';
import { pipeline_service } from '../services/pipeline_service';
import { agent_service } from '../services/agent_service';
import { logger } from '../utils/logger';

const KEEPALIVE_INTERVAL_MS = 25_000;

export const events_routes = new Hono<AppBindings>()

    .get('/stream', (context) => {
        return streamSSE(context, async (stream) => {
            let event_id = 0;
            let alive = true;

            stream.onAbort(() => {
                alive = false;
            });

            // Send initial snapshot so the client has immediate data
            const pipeline_info = pipeline_service.get_status();
            const all_processes = agent_service.get_all_processes();

            await stream.writeSSE({
                data: JSON.stringify({
                    pipeline: pipeline_info,
                    agents: all_processes
                }),
                event: 'snapshot',
                id: String(event_id++)
            });

            // Subscribe to event bus
            const event_queue: ServerEvent[] = [];
            let wake: (() => void) | null = null;

            const unsubscribe = event_bus.subscribe((event) => {
                event_queue.push(event);
                wake?.();
                wake = null;
            });

            try {
                while (alive) {
                    // Wait for events or keepalive timeout
                    if (event_queue.length === 0) {
                        await Promise.race([
                            new Promise<void>((resolve) => {
                                wake = resolve;
                            }),
                            stream.sleep(KEEPALIVE_INTERVAL_MS)
                        ]);
                    }

                    // Drain the event queue
                    while (event_queue.length > 0 && alive) {
                        const event = event_queue.shift();
                        if (!event) break;
                        await stream.writeSSE({
                            data: JSON.stringify(event.data),
                            event: event.type,
                            id: String(event_id++)
                        });
                    }

                    // Send keepalive ping if no events were sent
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
            }
        });
    });

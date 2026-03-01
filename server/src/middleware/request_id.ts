import { createMiddleware } from 'hono/factory';
import type { AppBindings } from './supabase';

/** Attach a short correlation ID to every request */
export function request_id_middleware() {
    return createMiddleware<AppBindings>(async (context, next) => {
        const request_id = crypto.randomUUID().slice(0, 8);
        context.set('request_id', request_id);
        await next();
    });
}

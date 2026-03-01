import { z } from 'zod';
import type { Context, Next } from 'hono';

const uuid_schema = z.string().uuid();

/** Middleware that validates named path params are valid UUIDs */
export function validate_uuid_params(...param_names: string[]) {
    return async (c: Context, next: Next) => {
        for (const name of param_names) {
            const value = c.req.param(name);
            if (value && !uuid_schema.safeParse(value).success) {
                return c.json(
                    { error: `Invalid ${name}: must be a valid UUID` },
                    400
                );
            }
        }
        await next();
    };
}

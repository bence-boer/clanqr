import { z } from 'zod';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

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

/** Extract a required route parameter with type narrowing.
 *  Use after validate_uuid_params in the middleware chain. */
export function require_param(c: Context, name: string): string {
    const value = c.req.param(name);
    if (!value) {
        throw new HTTPException(400, { message: `Missing required parameter: ${name}` });
    }
    return value;
}

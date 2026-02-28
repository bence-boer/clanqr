import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Return a standardized error JSON response */
export function error_response(
    c: Context,
    status: ContentfulStatusCode,
    message: string,
    details?: unknown,
) {
    return c.json(
        {
            error: {
                code: status,
                message,
                ...(details ? { details } : {}),
            },
        },
        status,
    );
}

/** Return a standardized success JSON response */
export function success_response<T>(
    c: Context,
    data: T,
    status: ContentfulStatusCode = 200,
) {
    return c.json({ data }, status);
}

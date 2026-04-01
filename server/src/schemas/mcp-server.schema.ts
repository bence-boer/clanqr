import { z } from 'zod';

export const create_mcp_server_schema = z.object({
    name: z.string().min(1).max(200),
    server_type: z.enum(['stdio', 'http', 'sse']),
    command: z.string().max(1000).nullable().optional(),
    args: z.array(z.string()).nullable().optional(),
    env: z.record(z.string()).nullable().optional(),
    url: z.string().url().nullable().optional(),
    is_global: z.boolean().default(true),
    status: z.enum(['active', 'inactive']).default('active')
});

export const update_mcp_server_schema = z.object({
    name: z.string().min(1).max(200).optional(),
    server_type: z.enum(['stdio', 'http', 'sse']).optional(),
    command: z.string().max(1000).nullable().optional(),
    args: z.array(z.string()).nullable().optional(),
    env: z.record(z.string()).nullable().optional(),
    url: z.string().url().nullable().optional(),
    is_global: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional()
});

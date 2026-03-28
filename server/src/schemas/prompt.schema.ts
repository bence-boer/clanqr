import { z } from 'zod';

export const create_prompt_schema = z.object({
    agent_type: z.enum(['manager', 'ralph', 'researcher', 'editor', 'chat', 'custom']),
    content: z.string().min(1).max(50_000),
    version: z.number().int().min(1).default(1),
    is_active: z.boolean().default(true)
});

export const update_prompt_schema = z.object({
    content: z.string().min(1).max(50_000).optional(),
    is_active: z.boolean().optional()
});

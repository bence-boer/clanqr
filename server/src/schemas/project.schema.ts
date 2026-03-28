import { z } from 'zod';

export const create_project_schema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(['active', 'archived', 'planning']).default('active')
});

export const update_project_schema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(['active', 'archived', 'planning']).optional()
});

import { z } from 'zod';

export const create_trait_schema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    content: z.string().min(1).max(10_000),
    target: z.enum(['manager', 'ralph', 'researcher', 'editor', 'chat', 'custom']),
    is_global: z.boolean().default(false)
});

export const update_trait_schema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    content: z.string().min(1).max(10_000).optional(),
    target: z.enum(['manager', 'ralph', 'researcher', 'editor', 'chat', 'custom']).optional(),
    is_global: z.boolean().optional()
});

export const assign_trait_schema = z.object({
    trait_id: z.string().uuid(),
    scope: z.enum(['project', 'feature', 'task']),
    project_id: z.string().uuid().nullable().optional(),
    feature_id: z.string().uuid().nullable().optional(),
    task_id: z.string().uuid().nullable().optional(),
    is_excluded: z.boolean().default(false)
});

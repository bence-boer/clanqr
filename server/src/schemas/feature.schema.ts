import { z } from 'zod';

export const create_feature_schema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).nullable().optional(),
    status: z.enum(['draft', 'submitted', 'in_progress', 'done', 'cancelled']).default('draft'),
    auto_approve: z.boolean().default(false),
    on_task_failure: z.enum(['stop', 'skip', 'retry']).default('stop'),
    task_timeout_minutes: z.number().int().min(1).max(1440).default(30),
    resources: z.array(z.object({
        url: z.string().url(),
        title: z.string().max(200).optional()
    })).optional()
});

export const update_feature_schema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10_000).nullable().optional(),
    status: z.enum(['draft', 'submitted', 'in_progress', 'done', 'cancelled']).optional(),
    auto_approve: z.boolean().optional(),
    on_task_failure: z.enum(['stop', 'skip', 'retry']).optional(),
    task_timeout_minutes: z.number().int().min(1).max(1440).optional()
});

import { z } from 'zod';

export const create_task_schema = z.object({
    feature_id: z.string().uuid(),
    title: z.string().max(200).nullable().optional(),
    description: z.string().min(1).max(10_000),
    status: z.enum(['queued', 'approved', 'in_progress', 'complete', 'failed', 'skipped']).default('queued'),
    sort_order: z.number().int().min(0).default(0),
    max_retries: z.number().int().min(0).max(10).default(3),
    agent_type: z.string().max(50).default('implementer'),
    execution_strategy: z.enum(['parallel', 'sequential', 'background']).default('sequential'),
    skills: z.array(z.string().max(100)).max(20).default([]),
    context_paths: z.array(z.string().max(500)).max(50).default([]),
    definition_of_done: z.string().max(5000).nullable().optional(),
    wave_number: z.number().int().min(0).nullable().optional()
});

export const update_task_schema = z.object({
    title: z.string().max(200).nullable().optional(),
    description: z.string().min(1).max(10_000).optional(),
    status: z.enum(['queued', 'approved', 'in_progress', 'complete', 'failed', 'skipped']).optional(),
    sort_order: z.number().int().min(0).optional(),
    output: z.string().max(50_000).nullable().optional(),
    max_retries: z.number().int().min(0).max(10).optional(),
    agent_type: z.string().max(50).optional(),
    execution_strategy: z.enum(['parallel', 'sequential', 'background']).optional(),
    skills: z.array(z.string().max(100)).max(20).optional(),
    context_paths: z.array(z.string().max(500)).max(50).optional(),
    definition_of_done: z.string().max(5000).nullable().optional()
});

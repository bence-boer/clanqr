import { z } from 'zod';

export const create_agent_session_schema = z.object({
    session_id: z.string().max(500).optional(),
    agent_type: z.enum(['orchestrator', 'explorer', 'architect', 'implementer', 'verifier', 'reviewer', 'synthesizer', 'researcher', 'chat', 'custom']),
    feature_id: z.string().uuid().nullable().optional(),
    task_id: z.string().uuid().nullable().optional(),
    model: z.string().max(100).nullable().optional(),
    source: z.enum(['new', 'resume']).default('new')
});

export const update_agent_session_schema = z.object({
    status: z.enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']).optional(),
    model: z.string().max(100).nullable().optional(),
    prompt_tokens: z.number().int().min(0).optional(),
    completion_tokens: z.number().int().min(0).optional(),
    cache_read_tokens: z.number().int().min(0).optional(),
    cache_write_tokens: z.number().int().min(0).optional(),
    duration_ms: z.number().int().min(0).nullable().optional(),
    summary: z.string().max(10_000).nullable().optional(),
    error: z.string().max(10_000).nullable().optional(),
    files_changed: z.array(z.string()).nullable().optional(),
    started_at: z.string().datetime().nullable().optional(),
    finished_at: z.string().datetime().nullable().optional()
});

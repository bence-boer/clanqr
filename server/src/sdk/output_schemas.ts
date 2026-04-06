/**
 * Zod schemas for structured agent output validation.
 * Separated from output_parser.ts to keep files under 200 lines.
 */
import { z } from 'zod';

// ── Legacy schemas (backward compat) ─────────────────────────────────────────

/** @deprecated Use orchestrator_task_schema instead */
export const manager_task_schema = z.object({
    title: z.string().min(5).max(80),
    description: z.string().min(20).max(5000)
});

/** @deprecated Use orchestrator_output_schema instead */
export const manager_output_schema = z.array(manager_task_schema).min(1).max(50);

/** @deprecated Use implementer_output_schema instead */
export const ralph_output_schema = z.object({
    status: z.enum(['completed', 'failed', 'partial']),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional()
});

// ── V2 agent output schemas ─────────────────────────────────────────────────

export const orchestrator_task_schema = z.object({
    task_id: z.string().min(1),
    description: z.string().min(10).max(5000),
    assignee_role: z.string().min(1),
    dependencies: z.array(z.string()).default([]),
    context_paths: z.array(z.string()).default([]),
    execution_strategy: z.enum(['parallel', 'sequential', 'background']).default('sequential'),
    skills: z.array(z.string()).default([]),
    definition_of_done: z.string().min(5)
});

export const orchestrator_output_schema = z.array(orchestrator_task_schema).min(1).max(50);

export const implementer_output_schema = z.object({
    status: z.enum(['completed', 'failed', 'partial']),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional()
});

export const verifier_output_schema = z.object({
    verdict: z.enum(['approved', 'rejected']),
    criteria: z.array(z.object({
        name: z.string(),
        passed: z.boolean(),
        evidence: z.string().optional()
    })).default([]),
    summary: z.string().optional()
});

export const reviewer_output_schema = z.object({
    verdict: z.enum(['ship', 'no-ship']),
    findings: z.array(z.object({
        severity: z.enum(['blocking', 'major', 'minor', 'nitpick']),
        description: z.string(),
        file: z.string().optional(),
        suggestion: z.string().optional()
    })).default([]),
    summary: z.string().optional()
});

// ── Inferred types ───────────────────────────────────────────────────────────

/** @deprecated Use OrchestratorTask instead */
export type ManagerTask = z.infer<typeof manager_task_schema>;
/** @deprecated Use ImplementerResult instead */
export type RalphResult = z.infer<typeof ralph_output_schema>;

export type OrchestratorTask = z.infer<typeof orchestrator_task_schema>;
export type ImplementerResult = z.infer<typeof implementer_output_schema>;
export type VerifierResult = z.infer<typeof verifier_output_schema>;
export type ReviewerResult = z.infer<typeof reviewer_output_schema>;

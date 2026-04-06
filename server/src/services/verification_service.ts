/**
 * Verification Service — gate logic for the V2 pipeline.
 *
 * Determines whether a task needs verification, dispatches the verifier agent,
 * and handles approved / rejected / retry outcomes.
 */
import { create_supabase_client } from '../db';
import type { TypedSupabaseClient } from '../db';
import { logger } from '../utils/logger';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_VERIFICATION_RETRIES = 3;
const VERIFIABLE_ROLES = new Set(['implementer', 'architect']);

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerificationResult {
    verdict: 'approved' | 'rejected'
    reasons: string[]
    verdict_source?: 'stub' | 'agent'
}

export type VerificationOutcome = 'approved' | 'retry' | 'escalate';

// ── should_verify ────────────────────────────────────────────────────────────

/**
 * Returns true when a task's agent type is verifiable and it has a non-empty
 * definition of done.
 */
export function should_verify(task: {
    agent_type: string
    definition_of_done: string | null
}): boolean {
    return (
        VERIFIABLE_ROLES.has(task.agent_type)
        && task.definition_of_done !== null
        && task.definition_of_done.trim().length > 0
    );
}

// ── dispatch_verifier ────────────────────────────────────────────────────────

/**
 * Dispatches a verifier agent for the given task.
 *
 * Currently returns a stub approval — the real implementation will invoke
 * run_agent_session once sdk_session_service is rewritten.
 */
export async function dispatch_verifier(
    task_id: string,
    feature_id: string,
    supabase?: TypedSupabaseClient
): Promise<VerificationResult> {
    const db = supabase ?? create_supabase_client();

    // Load task for context (will be passed to the verifier agent later)
    const { data: task, error } = await db
        .from('tasks')
        .select('id, title, description, definition_of_done, output, agent_type')
        .eq('id', task_id)
        .single();

    if (error || !task) {
        logger.error('dispatch_verifier: task not found', {
            service: 'verification',
            task_id,
            error: error?.message
        });
        return { verdict: 'rejected', reasons: ['Task not found for verification'] };
    }

    // TODO(verification): This stub auto-approves every task. Replace with a
    //   real verifier agent session (via run_agent_session) once
    //   sdk_session_service supports spawning verifier sessions. Until then no
    //   task is genuinely verified — consumers should check verdict_source.
    logger.warn('dispatch_verifier: returning stub approval (no real verifier configured)', {
        service: 'verification',
        task_id,
        feature_id
    });

    return { verdict: 'approved', reasons: [], verdict_source: 'stub' };
}

// ── handle_verification_result ───────────────────────────────────────────────

/**
 * Processes a verification result:
 * - approved  → mark task verification_status as 'approved'
 * - rejected  → retry (re-queue) or escalate depending on retry count
 */
export async function handle_verification_result(
    task_id: string,
    feature_id: string,
    result: VerificationResult,
    supabase?: TypedSupabaseClient
): Promise<VerificationOutcome> {
    const db = supabase ?? create_supabase_client();

    if (result.verdict === 'approved') {
        const { error } = await db
            .from('tasks')
            .update({ verification_status: 'approved' })
            .eq('id', task_id);

        if (error) {
            logger.error('handle_verification_result: failed to approve', {
                service: 'verification',
                task_id,
                error: error.message
            });
        }

        return 'approved';
    }

    // Rejected — check retry budget
    const { data: task, error: fetch_err } = await db
        .from('tasks')
        .select('retry_count')
        .eq('id', task_id)
        .single();

    if (fetch_err || !task) {
        logger.error('handle_verification_result: task not found for retry check', {
            service: 'verification',
            task_id,
            error: fetch_err?.message
        });
        return 'escalate';
    }

    const current_retries = task.retry_count ?? 0;

    if (current_retries < MAX_VERIFICATION_RETRIES) {
        // Retry: bump count + reset to approved for re-execution
        const { error: update_err } = await db
            .from('tasks')
            .update({
                retry_count: current_retries + 1,
                status: 'approved',
                verification_status: 'pending'
            })
            .eq('id', task_id);

        if (update_err) {
            logger.error('handle_verification_result: failed to set retry', {
                service: 'verification',
                task_id,
                error: update_err.message
            });
        }

        logger.info('Verification rejected — retrying', {
            service: 'verification',
            task_id,
            feature_id,
            attempt: current_retries + 1,
            reasons: result.reasons
        });

        return 'retry';
    }

    // Exhausted retries — escalate
    const { error: esc_err } = await db
        .from('tasks')
        .update({ verification_status: 'rejected' })
        .eq('id', task_id);

    if (esc_err) {
        logger.error('handle_verification_result: failed to reject', {
            service: 'verification',
            task_id,
            error: esc_err.message
        });
    }

    logger.warn('Verification rejected — escalating (max retries reached)', {
        service: 'verification',
        task_id,
        feature_id,
        reasons: result.reasons
    });

    return 'escalate';
}

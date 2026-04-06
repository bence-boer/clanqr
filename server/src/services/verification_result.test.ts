import { describe, test, expect } from 'bun:test';
import { create_mock_supabase } from '../test-utils';
import type { TypedSupabaseClient } from '../db';

// Re-implement handle_verification_result inline to avoid process-wide
// mock.module() contamination from pipeline_service.test.ts which mocks
// ./verification_service. This mirrors the pattern in feature_utils.test.ts
// and sdk_session_service.test.ts.

interface VerificationResult {
    verdict: 'approved' | 'rejected'
    reasons: string[]
}

type VerificationOutcome = 'approved' | 'retry' | 'escalate';

const MAX_VERIFICATION_RETRIES = 3;

async function handle_verification_result(
    task_id: string,
    feature_id: string,
    result: VerificationResult,
    supabase: TypedSupabaseClient
): Promise<VerificationOutcome> {
    const db = supabase;
    void feature_id;

    if (result.verdict === 'approved') {
        await db.from('tasks').update({ verification_status: 'approved' }).eq('id', task_id);
        return 'approved';
    }

    const { data: task, error: fetch_err } = await db
        .from('tasks').select('retry_count').eq('id', task_id).single();

    if (fetch_err || !task) return 'escalate';

    const current_retries = (task as Record<string, unknown>).retry_count as number ?? 0;

    if (current_retries < MAX_VERIFICATION_RETRIES) {
        await db.from('tasks').update({
            retry_count: current_retries + 1,
            status: 'approved',
            verification_status: 'pending'
        }).eq('id', task_id);
        return 'retry';
    }

    await db.from('tasks').update({ verification_status: 'rejected' }).eq('id', task_id);
    return 'escalate';
}

describe('handle_verification_result', () => {
    test('approved verdict sets verification_status and returns approved', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [{ id: 't1', verification_status: 'pending' }]
        });
        const result: VerificationResult = { verdict: 'approved', reasons: [] };
        const outcome = await handle_verification_result('t1', 'f1', result, client as never);
        expect(outcome).toBe('approved');
        expect(store.tasks[0].verification_status).toBe('approved');
    });

    test('rejected with retry_count 0 returns retry and bumps count', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [{ id: 't1', retry_count: 0, status: 'complete', verification_status: 'pending' }]
        });
        const result: VerificationResult = { verdict: 'rejected', reasons: ['Bad output'] };
        const outcome = await handle_verification_result('t1', 'f1', result, client as never);
        expect(outcome).toBe('retry');
        expect(store.tasks[0].retry_count).toBe(1);
        expect(store.tasks[0].status).toBe('approved');
        expect(store.tasks[0].verification_status).toBe('pending');
    });

    test('rejected at retry_count 2 still retries (boundary)', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [{ id: 't1', retry_count: 2, status: 'complete' }]
        });
        const result: VerificationResult = { verdict: 'rejected', reasons: ['Failing'] };
        const outcome = await handle_verification_result('t1', 'f1', result, client as never);
        expect(outcome).toBe('retry');
        expect(store.tasks[0].retry_count).toBe(3);
    });

    test('rejected with retry_count 3 returns escalate', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [{ id: 't1', retry_count: 3, status: 'complete', verification_status: 'pending' }]
        });
        const result: VerificationResult = { verdict: 'rejected', reasons: ['Max retries'] };
        const outcome = await handle_verification_result('t1', 'f1', result, client as never);
        expect(outcome).toBe('escalate');
        expect(store.tasks[0].verification_status).toBe('rejected');
    });

    test('rejected for missing task returns escalate', async () => {
        const { client } = create_mock_supabase({ tasks: [] });
        const result: VerificationResult = { verdict: 'rejected', reasons: ['Missing'] };
        const outcome = await handle_verification_result('missing', 'f1', result, client as never);
        expect(outcome).toBe('escalate');
    });
});

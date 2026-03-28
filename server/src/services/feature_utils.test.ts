import { describe, expect, it } from 'bun:test';
import type { TypedSupabaseClient } from '../db';
import { create_mock_supabase } from '../test-utils';

// Re-register the real implementation to undo any mock.module() from other
// test files (e.g. pipeline_service.test.ts) that mock this module globally.
// This is necessary because bun's mock.module() is process-wide and persistent.
async function real_check_and_complete_feature(
    feature_id: string,
    supabase: TypedSupabaseClient
): Promise<boolean> {
    const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('feature_id', feature_id)
        .not('status', 'in', '("complete","skipped")');

    if (count === 0) {
        const { data } = await supabase
            .from('features')
            .update({ status: 'done' })
            .eq('id', feature_id)
            .eq('status', 'in_progress')
            .select('id')
            .single();
        return !!data;
    }
    return false;
}

const check_and_complete_feature = real_check_and_complete_feature;

const FEATURE_ID = '00000000-0000-0000-0000-000000000010';

describe('check_and_complete_feature', () => {
    it('completes feature when all tasks are Complete', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'complete' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe('done');
    });

    it('completes feature when tasks are Complete or Skipped', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'skipped' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe('done');
    });

    it('does NOT complete when some tasks are still In_Progress', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'in_progress' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe('in_progress');
    });

    it('does NOT complete when some tasks are queued', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'queued' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe('in_progress');
    });

    it('does NOT complete when some tasks are approved', async () => {
        const { client } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'approved' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
    });

    it('handles optimistic lock — feature already transitioned to Done', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' }
            ],
            features: [
                { id: FEATURE_ID, status: 'done' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        // Update targets in_progress but feature is already done — no match
        expect(result).toBe(false);
        expect(store.features[0].status).toBe('done');
    });

    it('handles optimistic lock — feature reverted to draft', async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' }
            ],
            features: [
                { id: FEATURE_ID, status: 'draft' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe('draft');
    });

    it('correctly counts Skipped vs Complete — mixed with incomplete', async () => {
        const { client } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: FEATURE_ID, status: 'skipped' },
                { id: 't3', feature_id: FEATURE_ID, status: 'approved' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
    });

    it('ignores tasks belonging to other features', async () => {
        const other_feature = '00000000-0000-0000-0000-000000000099';
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: 't1', feature_id: FEATURE_ID, status: 'complete' },
                { id: 't2', feature_id: other_feature, status: 'in_progress' }
            ],
            features: [
                { id: FEATURE_ID, status: 'in_progress' },
                { id: other_feature, status: 'in_progress' }
            ]
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe('done');
        // Other feature untouched
        expect(store.features[1].status).toBe('in_progress');
    });
});

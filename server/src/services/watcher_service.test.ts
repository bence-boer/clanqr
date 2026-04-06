import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { create_mock_supabase } from '../test-utils';

let mock_can_start = true;
let session_fn: () => Promise<unknown>;

mock.module('../db', () => ({
    create_supabase_client: () => ({})
}));
mock.module('../utils/logger', () => ({
    logger: { info: () => {
    }, warn: () => {
    }, error: () => {
    }, debug: () => {
    } }
}));
mock.module('./event_bus', () => ({
    event_bus: { emit: () => {
    } }
}));
mock.module('./session_pool_service', () => ({
    can_start_session: () => mock_can_start
}));
mock.module('./sdk_session_service', () => ({
    run_agent_session: () => session_fn()
}));
mock.module('./prompt_service', () => ({
    prompt_service: { resolve_for_manager: () => Promise.resolve('prompt') }
}));
mock.module('./dag_service', () => ({
    validate_dag: () => ({ valid: true, errors: [] }),
    insert_dag_from_plan: () => Promise.resolve(),
    compute_waves: () => Promise.resolve(1)
}));
mock.module('../sdk/output_parser', () => ({
    parse_orchestrator_output: () => ({ tasks: [] })
}));
mock.module('./pipeline_service', () => ({
    pipeline_service: { process_ready_tasks: () => Promise.resolve() }
}));

import { watcher_service } from './watcher_service';

/* Access private methods via type assertion */
type WatcherPrivate = {
    check_submitted_features: (sb: unknown) => Promise<void>
    plan_with_dag: (feat: unknown, sb: unknown) => Promise<void>
};
const priv = watcher_service as unknown as WatcherPrivate;
const check = (sb: unknown) => priv.check_submitted_features(sb);
const plan = (feat: unknown, sb: unknown) => priv.plan_with_dag(feat, sb);

describe('check_submitted_features', () => {
    beforeEach(() => {
        mock_can_start = true;
        session_fn = () => Promise.resolve({
            session_id: 'sid', db_session_id: 'db-1', success: true,
            content: '{"tasks":[]}',
            metrics: {
                prompt_tokens: 0, completion_tokens: 0,
                total_cost: 0, duration_ms: 0, files_changed: []
            }
        });
    });

    test('does nothing when no submitted features exist', async () => {
        const { client, store } = create_mock_supabase({ features: [] });
        await check(client);
        expect(store.features).toEqual([]);
    });

    test('rolls back to draft when manager_retry_count >= 3', async () => {
        const { client, store } = create_mock_supabase({
            features: [{
                id: 'f1', status: 'submitted', manager_retry_count: 3,
                title: 'F', description: 'D', project_id: 'p1'
            }]
        });
        await check(client);
        expect(store.features[0].status).toBe('draft');
        expect(store.features[0].last_error).toContain('3 attempts');
    });

    test('skips feature with recent orchestrator session', async () => {
        const { client, store } = create_mock_supabase({
            features: [{
                id: 'f1', status: 'submitted', manager_retry_count: 0,
                title: 'F', description: 'D', project_id: 'p1'
            }],
            agent_sessions: [{
                id: 'as-1', agent_type: 'orchestrator', feature_id: 'f1',
                status: 'running', created_at: new Date().toISOString()
            }]
        });
        await check(client);
        expect(store.features[0].manager_retry_count).toBe(0);
    });

    test('skips feature when session pool is full', async () => {
        mock_can_start = false;
        const { client, store } = create_mock_supabase({
            features: [{
                id: 'f1', status: 'submitted', manager_retry_count: 0,
                title: 'F', description: 'D', project_id: 'p1'
            }]
        });
        await check(client);
        expect(store.features[0].manager_retry_count).toBe(0);
    });

    test('increments retry count for eligible feature', async () => {
        const { client, store } = create_mock_supabase({
            features: [{
                id: 'f1', status: 'submitted', manager_retry_count: 0,
                title: 'F', description: 'D', project_id: 'p1'
            }]
        });
        await check(client);
        expect(store.features[0].manager_retry_count).toBe(1);
    });
});

describe('plan_with_dag', () => {
    test('marks feature as draft when orchestrator session fails', async () => {
        session_fn = () => Promise.resolve({
            session_id: 'sid', db_session_id: 'db-1', success: false,
            content: '', error: 'Session crashed',
            metrics: {
                prompt_tokens: 0, completion_tokens: 0,
                total_cost: 0, duration_ms: 0, files_changed: []
            }
        });
        const { client, store } = create_mock_supabase({
            features: [{ id: 'f1', status: 'submitted', project_id: 'p1' }]
        });
        const feature = {
            id: 'f1', title: 'F', description: 'D', project_id: 'p1',
            planning_model: 'gpt-4.1', resources: [],
            projects: { name: 'P' }
        };
        await plan(feature, client);
        expect(store.features[0].status).toBe('draft');
        expect(store.features[0].last_error).toContain('Session crashed');
    });
});

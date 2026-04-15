import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { create_mock_supabase } from '../test-utils';
import type { MockStore } from '../mock_query_builder';

let shared_store: MockStore;
let mock_client: unknown;
let session_fn: () => Promise<unknown>;
let failure_fn: () => Promise<string>;

mock.module('../db', () => ({
    create_supabase_client: () => mock_client
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
mock.module('./prompt_service', () => ({
    prompt_service: {
        resolve_for_task: () => Promise.resolve('prompt'),
        resolve_for_manager: () => Promise.resolve('prompt'),
        sync_from_repo: () => Promise.resolve(),
        get_prompt: () => Promise.resolve(null),
        update_prompt: () => Promise.resolve(true)
    }
}));
mock.module('./sdk_session_service', () => ({
    run_agent_session: () => session_fn()
}));
mock.module('./pipeline_failure', () => ({
    handle_task_failure: () => failure_fn()
}));
mock.module('./feature_utils', () => ({
    check_and_complete_feature: () => Promise.resolve(false)
}));
mock.module('./dag_service', () => ({
    get_ready_tasks: () => Promise.resolve([])
}));

import { run_task_lifecycle } from './pipeline_dispatch';
import type { PipelineTask } from './pipeline_failure';

const OK_RESULT = {
    session_id: 'sid-1', db_session_id: 'db-1', success: true,
    content: 'output',
    metrics: {
        prompt_tokens: 0, completion_tokens: 0, total_cost: 0,
        duration_ms: 0, files_changed: [] as string[]
    }
};

const FAIL_RESULT = {
    ...OK_RESULT, session_id: 'sid-2', success: false,
    content: '', error: 'timeout'
};

function make_task(): PipelineTask {
    return {
        id: 'task-1', feature_id: 'feat-1', title: 'T', description: 'D',
        status: 'approved', sort_order: 0, retry_count: 0, max_retries: 1,
        created_at: '2026-01-01', agent_type: 'implementer',
        features: {
            title: 'F', execution_model: null, on_task_failure: 'stop',
            task_timeout_minutes: 10, projects: { id: 'p1', name: 'P' }
        }
    } as unknown as PipelineTask;
}

describe('run_task_lifecycle', () => {
    beforeEach(() => {
        const m = create_mock_supabase({
            tasks: [{ id: 'task-1', feature_id: 'feat-1', status: 'approved' }]
        });
        mock_client = m.client;
        shared_store = m.store;
        session_fn = () => Promise.resolve(OK_RESULT);
        failure_fn = () => Promise.resolve('stop');
    });

    test('successful session sets task to complete and reports session id', async () => {
        const ids: string[] = [];
        await run_task_lifecycle(make_task(), (s) => ids.push(s), () => {
        });
        expect(ids).toEqual(['sid-1']);
        expect(shared_store.tasks[0].status).toBe('complete');
    });

    test('failed session with stop outcome triggers on_pause', async () => {
        session_fn = () => Promise.resolve(FAIL_RESULT);
        let paused = false;
        await run_task_lifecycle(make_task(), () => {
        }, () => {
            paused = true;
        });
        expect(paused).toBe(true);
    });

    test('failed session with retry outcome does not trigger on_pause', async () => {
        session_fn = () => Promise.resolve(FAIL_RESULT);
        failure_fn = () => Promise.resolve('retry');
        let paused = false;
        await run_task_lifecycle(make_task(), () => {
        }, () => {
            paused = true;
        });
        expect(paused).toBe(false);
    });

    test('thrown exception triggers on_pause when failure outcome is stop', async () => {
        session_fn = () => Promise.reject(new Error('Network error'));
        let paused = false;
        await run_task_lifecycle(make_task(), () => {
        }, () => {
            paused = true;
        });
        expect(paused).toBe(true);
    });
});

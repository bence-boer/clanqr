import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { create_mock_supabase } from '../test-utils';

// --- Mocks must be registered before importing pipeline_service ---

let mock_store: Parameters<typeof create_mock_supabase>[0] = {};

let mock_can_start = true;

mock.module('../db', () => ({
    create_supabase_client: () => create_mock_supabase(mock_store).client
}));

mock.module('../env', () => ({
    WORKSPACE_DIR: '/tmp/test-pipeline-workspace',
    env: {
        SDK_MAX_CONCURRENT_SESSIONS: 5,
        HOME: '/tmp',
        PATH: '/usr/bin',
        CLI_URL: 'localhost:4321',
        SDK_SESSION_TIMEOUT_MS: 600_000
    },
    ENRICHED_PATH: '/usr/bin'
}));

mock.module('./session_pool_service', () => ({
    can_start_session: () => mock_can_start,
    increment_sessions: () => {
        /* noop */
    },
    decrement_sessions: () => {
        /* noop */
    },
    set_on_session_freed: () => {
        /* noop */
    },
    get_session_concurrency: () => ({
        active: 0,
        max: 5
    })
}));

mock.module('./sdk_session_service', () => ({
    execute_task: () => Promise.resolve({ session_id: 'test-session', success: true, content: 'done' })
}));

mock.module('./prompt_service', () => ({
    prompt_service: {
        resolve_for_task: () => Promise.resolve('test prompt')
    }
}));

mock.module('./feature_utils', () => ({
    check_and_complete_feature: () => Promise.resolve(false)
}));

mock.module('../utils/logger', () => ({
    logger: {
        info: () => {
            /* noop */
        },
        warn: () => {
            /* noop */
        },
        error: () => {
            /* noop */
        },
        debug: () => {
            /* noop */
        }
    }
}));

// Now import the module under test
import { pipeline_service } from './pipeline_service';

describe('PipelineService', () => {
    beforeEach(() => {
        Object.assign(pipeline_service, { state: 'idle', active_run: null, is_processing: false });
        mock_can_start = true;
        mock_store = { tasks: [], features: [], agent_sessions: [] };
    });

    describe('get_status', () => {
        it('returns idle state with no active run', () => {
            const status = pipeline_service.get_status();
            expect(status.state).toBe('idle');
            expect(status.current_task_id).toBeNull();
            expect(status.current_run_id).toBeNull();
            expect(status.current_feature_id).toBeNull();
        });

        it('reflects paused state', () => {
            Object.assign(pipeline_service, { state: 'paused' });
            expect(pipeline_service.get_status().state).toBe('paused');
        });

        it('reflects active run info', () => {
            Object.assign(pipeline_service, {
                state: 'running',
                active_run: { task_id: 'task-1', run_id: 'run-1', feature_id: 'feat-1' }
            });
            const status = pipeline_service.get_status();
            expect(status.state).toBe('running');
            expect(status.current_task_id).toBe('task-1');
            expect(status.current_run_id).toBe('run-1');
            expect(status.current_feature_id).toBe('feat-1');
        });
    });

    describe('pause / resume', () => {
        it('pauses when running', () => {
            Object.assign(pipeline_service, { state: 'running' });
            pipeline_service.pause();
            expect(pipeline_service.get_status().state).toBe('paused');
        });

        it('pauses when idle', () => {
            pipeline_service.pause();
            expect(pipeline_service.get_status().state).toBe('paused');
        });

        it('resumes from paused to idle', () => {
            Object.assign(pipeline_service, { state: 'paused' });
            pipeline_service.resume();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('does not resume when not paused', () => {
            Object.assign(pipeline_service, { state: 'running' });
            pipeline_service.resume();
            expect(pipeline_service.get_status().state).toBe('running');
        });
    });

    describe('process_next', () => {
        it('returns immediately when paused', async () => {
            Object.assign(pipeline_service, { state: 'paused' });
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('paused');
        });

        it('returns immediately when already processing', async () => {
            Object.assign(pipeline_service, { is_processing: true });
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('returns immediately when active_run exists', async () => {
            Object.assign(pipeline_service, { active_run: { task_id: 'x', run_id: 'y', feature_id: 'z' } });
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('sets state to idle when no tasks available', async () => {
            mock_store = { tasks: [], features: [], agent_sessions: [] };
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('does not exceed concurrency limit', async () => {
            mock_can_start = false;
            mock_store = {
                tasks: [{
                    id: 'task-1',
                    feature_id: 'feat-1',
                    description: 'Test task',
                    status: 'approved',
                    sort_order: 0,
                    retry_count: 0,
                    max_retries: 1,
                    created_at: '2026-01-01T00:00:00Z',
                    features: { title: 'F', execution_model: null, on_task_failure: 'stop', task_timeout_minutes: 10, projects: { name: 'P', id: 'proj-1' } }
                }],
                features: [{ id: 'feat-1', status: 'in_progress' }],
                agent_sessions: []
            };
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().current_task_id).toBeNull();
        });
    });

    describe('stop_current', () => {
        it('does nothing when no active run', async () => {
            await pipeline_service.stop_current();
            expect(pipeline_service.get_status().state).toBe('idle');
        });
    });

    describe('get_log', () => {
        it('returns empty string when no active run', () => {
            expect(pipeline_service.get_log()).toBe('');
        });
    });
});

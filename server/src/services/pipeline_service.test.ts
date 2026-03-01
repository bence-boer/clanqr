import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { create_mock_supabase } from '../test-utils';

// --- Mocks must be registered before importing pipeline_service ---

let mock_store: Parameters<typeof create_mock_supabase>[0] = {};

const mock_stop_process = mock(() => {

});
const mock_get_log = mock(() => 'test log output');
let mock_can_spawn_result = true;

mock.module('../db', () => ({
    create_supabase_client: () => create_mock_supabase(mock_store).client
}));

mock.module('../env', () => ({
    WORKSPACE_DIR: '/tmp/test-pipeline-workspace',
    env: {
        MAX_CONCURRENT_AGENTS: 3,
        HOME: '/tmp',
        PATH: '/usr/bin'
    },
    COPILOT_BIN: 'copilot',
    GEMINI_BIN: 'gemini',
    ENRICHED_PATH: '/usr/bin',
    build_agent_env: () => ({})
}));

mock.module('./agent_service', () => ({
    can_spawn_agent: () => mock_can_spawn_result,
    increment_agent_count: () => {

    },
    decrement_agent_count: () => {

    },
    set_on_agent_freed: () => {

    },
    get_agent_concurrency: () => ({ active: 0, max: 3 }),
    agent_service: {
        stop_process: mock_stop_process,
        get_log: mock_get_log,
        get_all_processes: () => ({}),
        stop_all: () => {

        },
        spawn_manager: () => Promise.resolve(),
        cleanup_old_workspaces: () => 0
    }
}));

mock.module('./spawn_agent', () => ({
    spawn_agent: () => Promise.resolve({ run_id: 'test-run-id', exit_code: 0, log: 'ok' })
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

        },
        warn: () => {

        },
        error: () => {

        },
        debug: () => {

        }
    }
}));

// Now import the module under test
import { pipeline_service } from './pipeline_service';

describe('PipelineService', () => {
    beforeEach(() => {
        // Reset internal state between tests
        Object.assign(pipeline_service, { state: 'idle', active_run: null, is_processing: false });
        mock_can_spawn_result = true;
        mock_store = { tasks: [], features: [], agent_runs: [] };
        mock_stop_process.mockClear();
        mock_get_log.mockClear();
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

        it('does not pause when idle', () => {
            pipeline_service.pause();
            expect(pipeline_service.get_status().state).toBe('idle');
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
            // State remains idle since we short-circuited
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('returns immediately when active_run exists', async () => {
            Object.assign(pipeline_service, { active_run: { task_id: 'x', run_id: 'y', feature_id: 'z' } });
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('sets state to idle when no tasks available', async () => {
            mock_store = { tasks: [], features: [], agent_runs: [] };
            await pipeline_service.process_next();
            expect(pipeline_service.get_status().state).toBe('idle');
        });

        it('does not exceed concurrency limit', async () => {
            mock_can_spawn_result = false;
            mock_store = {
                tasks: [{
                    id: 'task-1',
                    feature_id: 'feat-1',
                    description: 'Test task',
                    status: 'Approved',
                    sort_order: 0,
                    retry_count: 0,
                    max_retries: 1,
                    created_at: '2026-01-01T00:00:00Z',
                    features: { title: 'F', cli: 'copilot', model: 'gpt-4o', on_task_failure: 'stop', task_timeout_minutes: 10, projects: { name: 'P' } }
                }],
                features: [{ id: 'feat-1', status: 'In_Progress' }],
                agent_runs: []
            };
            await pipeline_service.process_next();
            // Task should not be picked up — state returns to idle after is_processing clears
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

        it('delegates to agent_service when active run exists', () => {
            Object.assign(pipeline_service, { active_run: { task_id: 'task-1', run_id: 'run-1', feature_id: 'feat-1' } });
            const log = pipeline_service.get_log();
            expect(log).toBe('test log output');
            expect(mock_get_log).toHaveBeenCalledWith('task-1');
        });
    });
});

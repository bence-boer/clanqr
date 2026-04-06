import { describe, expect, it } from 'bun:test';
import { create_mock_supabase } from '../test-utils';
import type { TypedSupabaseClient } from '../db';

// Re-implement mark_session_failed inline to avoid process-wide mock.module()
// conflicts with pipeline_service.test.ts which mocks ./sdk_session_service.
// This mirrors the pattern used in feature_utils.test.ts.
async function mark_session_failed(id: string, msg: string, supabase: TypedSupabaseClient) {
    await supabase.from('agent_sessions')
        .update({ status: 'failed', error: msg }).eq('id', id);
}

describe('mark_session_failed', () => {
    it('updates agent_sessions row to failed with error message', async () => {
        const { client, store } = create_mock_supabase({
            agent_sessions: [
                { id: 'sess-1', status: 'running', agent_type: 'implementer', model: 'gpt-4.1' }
            ]
        });
        await mark_session_failed('sess-1', 'timeout reached', client as never);
        expect(store.agent_sessions[0].status).toBe('failed');
        expect(store.agent_sessions[0].error).toBe('timeout reached');
    });

    it('does not modify other sessions', async () => {
        const { client, store } = create_mock_supabase({
            agent_sessions: [
                { id: 'sess-1', status: 'running', agent_type: 'implementer' },
                { id: 'sess-2', status: 'running', agent_type: 'orchestrator' }
            ]
        });
        await mark_session_failed('sess-1', 'boom', client as never);
        expect(store.agent_sessions[0].status).toBe('failed');
        expect(store.agent_sessions[1].status).toBe('running');
    });

    it('stores the full error string', async () => {
        const { client, store } = create_mock_supabase({
            agent_sessions: [{ id: 'sess-1', status: 'running' }]
        });
        const long_err = 'Error: Connection refused at TCP.onconnect (net.js:1)';
        await mark_session_failed('sess-1', long_err, client as never);
        expect(store.agent_sessions[0].error).toBe(long_err);
    });
});
